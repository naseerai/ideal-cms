#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class SchoolManagementTester:
    def __init__(self, base_url="https://academic-pro-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_login_super_admin(self):
        """Test super admin login returns super_admin role"""
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "12345678"}
        )
        if success and response.get('role') == 'super_admin':
            print(f"   ✅ Role verified: {response.get('role')}")
            return True
        elif success:
            print(f"   ❌ Wrong role: Expected 'super_admin', got '{response.get('role')}'")
            self.failed_tests.append("Super Admin Login: Wrong role returned")
        return False

    def test_students_pagination(self):
        """Test students API returns paginated data"""
        success, response = self.run_test(
            "Students Pagination",
            "GET",
            "students",
            200,
            data={"page": 1, "limit": 50}
        )
        if success:
            required_fields = ['students', 'total', 'page', 'totalPages']
            missing_fields = [field for field in required_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Pagination fields present: {required_fields}")
                print(f"   📊 Total: {response.get('total')}, Page: {response.get('page')}, Total Pages: {response.get('totalPages')}")
                return True
            else:
                print(f"   ❌ Missing pagination fields: {missing_fields}")
                self.failed_tests.append(f"Students Pagination: Missing fields {missing_fields}")
        return False

    def test_concession_crud(self):
        """Test concession CRUD operations"""
        # Create concession
        concession_data = {
            "studentCode": "ADM001",
            "termNumber": 1,
            "concessionAmount": 1000,
            "requestedBy": "Test Teacher"
        }
        
        success, response = self.run_test(
            "Create Concession",
            "POST",
            "concessions",
            200,
            data=concession_data
        )
        
        if not success:
            return False
            
        concession_id = response.get('id')
        if not concession_id:
            print("   ❌ No concession ID returned")
            self.failed_tests.append("Create Concession: No ID returned")
            return False

        # Test approve concession
        success, _ = self.run_test(
            "Approve Concession",
            "POST",
            f"concessions/{concession_id}/approve",
            200
        )
        
        if not success:
            return False

        # Test reject concession (create another one first)
        success, response2 = self.run_test(
            "Create Concession for Rejection",
            "POST",
            "concessions",
            200,
            data={**concession_data, "termNumber": 2}
        )
        
        if success and response2.get('id'):
            success, _ = self.run_test(
                "Reject Concession",
                "POST",
                f"concessions/{response2.get('id')}/reject",
                200
            )
            return success
        
        return False

    def test_fee_revert(self):
        """Test fee revert functionality"""
        # First create a fee payment
        payment_data = {
            "studentId": "test-student-id",
            "studentCode": "ADM001",
            "rollNo": "1",
            "studentName": "Test Student",
            "termNumber": 1,
            "amount": 5000,
            "paymentMode": "cash",
            "collectedBy": "Test Admin"
        }
        
        success, response = self.run_test(
            "Create Fee Payment",
            "POST",
            "fees/payment",
            200,
            data=payment_data
        )
        
        if not success:
            return False
            
        payment_id = response.get('id')
        if not payment_id:
            print("   ❌ No payment ID returned")
            self.failed_tests.append("Create Fee Payment: No ID returned")
            return False

        # Test revert payment
        success, response = self.run_test(
            "Revert Fee Payment",
            "POST",
            f"fees/revert/{payment_id}",
            200
        )
        
        return success

    def test_promote_endpoint(self):
        """Test promote endpoint adds Rs.5000 to Term 3"""
        promote_data = {
            "fromClass": "1",
            "toClass": "2"
        }
        
        success, response = self.run_test(
            "Promote Students",
            "POST",
            "students/promote",
            200,
            data=promote_data
        )
        
        if success and "Rs.5000" in response.get('message', ''):
            print(f"   ✅ Promotion message confirms Rs.5000 addition: {response.get('message')}")
            return True
        elif success:
            print(f"   ❌ Promotion message doesn't mention Rs.5000: {response.get('message')}")
            self.failed_tests.append("Promote Students: Message doesn't mention Rs.5000 addition")
        
        return False

    def test_staff_admin_role(self):
        """Test staff creation with admin_role"""
        staff_data = {
            "name": "Test Admin Staff",
            "role": "admin_role",
            "mobile": "9876543210",
            "joiningDate": "2024-01-01",
            "username": "testadmin",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Create Admin Role Staff",
            "POST",
            "staff",
            200,
            data=staff_data
        )
        
        if success and response.get('role') == 'admin_role':
            print(f"   ✅ Admin role staff created successfully")
            return True
        elif success:
            print(f"   ❌ Wrong role returned: {response.get('role')}")
            self.failed_tests.append("Create Admin Role Staff: Wrong role returned")
        
        return False

    def test_get_concessions(self):
        """Test get concessions endpoint"""
        success, response = self.run_test(
            "Get Concessions",
            "GET",
            "concessions",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Concessions list returned with {len(response)} items")
            return True
        elif success:
            print(f"   ❌ Expected list, got: {type(response)}")
            self.failed_tests.append("Get Concessions: Expected list response")
        
        return False

def main():
    print("🚀 Starting School Management System API Tests")
    print("=" * 60)
    
    tester = SchoolManagementTester()
    
    # Test all the required features
    test_results = {
        "Super Admin Login": tester.test_login_super_admin(),
        "Students Pagination": tester.test_students_pagination(),
        "Concession CRUD": tester.test_concession_crud(),
        "Fee Revert": tester.test_fee_revert(),
        "Promote Endpoint": tester.test_promote_endpoint(),
        "Staff Admin Role": tester.test_staff_admin_role(),
        "Get Concessions": tester.test_get_concessions(),
    }
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<25} {status}")
    
    print(f"\nTotal Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {len(tester.failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            print(f"  - {failure}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())