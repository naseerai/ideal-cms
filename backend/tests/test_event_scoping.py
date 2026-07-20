"""Tests for calendar event class/section scoping (iteration 19)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def created_events():
    ids = []
    yield ids
    for eid in ids:
        try:
            requests.delete(f"{API}/events/{eid}")
        except Exception:
            pass


@pytest.fixture(scope="module")
def seed_events(created_events):
    scoped = requests.post(f"{API}/events", json={
        "title": "__T_SCOPED__", "description": "d", "date": "2026-07-20",
        "studentClass": "1", "section": "A", "sendNotification": False,
    })
    assert scoped.status_code == 200, scoped.text
    scoped_body = scoped.json()
    assert scoped_body["studentClass"] == "1"
    assert scoped_body["section"] == "A"
    created_events.append(scoped_body["id"])

    wide = requests.post(f"{API}/events", json={
        "title": "__T_WIDE__", "description": "d", "date": "2026-07-21",
        "sendNotification": False,
    })
    assert wide.status_code == 200, wide.text
    wide_body = wide.json()
    # school-wide event: class/section absent or empty
    assert not wide_body.get("studentClass")
    assert not wide_body.get("section")
    created_events.append(wide_body["id"])
    return {"scoped": scoped_body, "wide": wide_body}


def _titles(events):
    return {e["title"] for e in events}


def test_events_class1_sectionA_returns_both(seed_events):
    r = requests.get(f"{API}/events", params={"month": "2026-07", "studentClass": "1", "section": "A"})
    assert r.status_code == 200
    titles = _titles(r.json())
    assert "__T_SCOPED__" in titles
    assert "__T_WIDE__" in titles


def test_events_class2_sectionB_returns_only_wide(seed_events):
    r = requests.get(f"{API}/events", params={"month": "2026-07", "studentClass": "2", "section": "B"})
    assert r.status_code == 200
    titles = _titles(r.json())
    assert "__T_WIDE__" in titles
    assert "__T_SCOPED__" not in titles


def test_events_no_filter_returns_both(seed_events):
    r = requests.get(f"{API}/events", params={"month": "2026-07"})
    assert r.status_code == 200
    titles = _titles(r.json())
    assert "__T_SCOPED__" in titles
    assert "__T_WIDE__" in titles


def test_send_event_notification_no_matching_students_does_not_throw(created_events):
    r = requests.post(f"{API}/events", json={
        "title": "__T_SEND_UNMATCHED__", "description": "d", "date": "2026-07-22",
        "studentClass": "ZZ", "section": "QQ", "sendNotification": True,
    })
    assert r.status_code == 200, r.text
    created_events.append(r.json()["id"])


def test_parent_dashboard_event_filter(created_events):
    # Pick an existing student
    resp = requests.get(f"{API}/students").json()
    slist = resp.get("students", resp) if isinstance(resp, dict) else resp
    if not slist:
        pytest.skip("No students to test parent-dashboard scoping")
    student = slist[0]
    sid = student["id"]
    sclass = student.get("studentClass", "")
    ssection = student.get("section", "")

    # Seed three events
    e_wide = requests.post(f"{API}/events", json={
        "title": "__T_PD_WIDE__", "description": "d", "date": "2026-08-01",
        "sendNotification": False,
    }).json()
    created_events.append(e_wide["id"])

    e_match = requests.post(f"{API}/events", json={
        "title": "__T_PD_MATCH__", "description": "d", "date": "2026-08-02",
        "studentClass": sclass, "section": ssection, "sendNotification": False,
    }).json()
    created_events.append(e_match["id"])

    # different class - pick something surely different
    other_class = "99Z" if sclass != "99Z" else "88Z"
    e_other = requests.post(f"{API}/events", json={
        "title": "__T_PD_OTHER__", "description": "d", "date": "2026-08-03",
        "studentClass": other_class, "section": "Z", "sendNotification": False,
    }).json()
    created_events.append(e_other["id"])

    r = requests.get(f"{API}/parent/dashboard/{sid}")
    assert r.status_code == 200, r.text
    ev_titles = {e["title"] for e in r.json().get("events", [])}
    assert "__T_PD_WIDE__" in ev_titles
    assert "__T_PD_MATCH__" in ev_titles
    assert "__T_PD_OTHER__" not in ev_titles
