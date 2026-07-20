import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, canCreate, canDelete, canEdit } from '../lib/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const HomeworkPage = () => {
  const { user, role, perms } = useAuth();
  const showCreate = canCreate(perms, 'homework');
  const showDelete = canDelete(perms, 'homework');
  const showEdit = canEdit(perms, 'homework');
  const defaultAssignedBy = user?.name || user?.username || '';
  const [homework, setHomework] = useState([]);
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ studentYear: '', studentClass: '', section: '' });
  const [form, setForm] = useState({ studentYear: '', studentClass: '', section: '', subject: '', title: '', description: '', dueDate: '', assignedBy: defaultAssignedBy, attachmentUrl: '', attachmentName: '' });

  // Keep assignedBy synced to logged-in user
  useEffect(() => {
    setForm((f) => ({ ...f, assignedBy: defaultAssignedBy }));
  }, [defaultAssignedBy]);

  const loadYears = useCallback(async () => {
    try { const r = await api.getYears(); setYears(r.data); } catch (e) { /* ignore */ }
  }, []);

  const loadClasses = useCallback(async () => {
    try { const r = await api.getClasses(); setClasses(r.data); } catch (e) { /* ignore */ }
  }, []);

  const loadHomework = useCallback(async () => {
    try {
      const params = {};
      if (filters.studentYear) params.studentYear = filters.studentYear;
      if (filters.studentClass) params.studentClass = filters.studentClass;
      if (filters.section) params.section = filters.section;
      const r = await api.getHomework(params);
      setHomework(r.data);
    } catch (e) { toast.error('Failed to load homework'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadYears(); loadClasses(); }, [loadYears, loadClasses]);
  useEffect(() => { loadHomework(); }, [loadHomework]);

  const getClassesForYear = (yearLabel) => {
    const yearId = years.find((y) => y.yearLabel === yearLabel)?.id;
    if (!yearId) return [];
    return classes.filter((c) => c.yearId === yearId);
  };
  const getSections = (yearLabel, cls) => { const f = getClassesForYear(yearLabel).find((c) => c.className === cls); return f ? f.sections : []; };

  const resetForm = () => {
    setForm({ studentYear: '', studentClass: '', section: '', subject: '', title: '', description: '', dueDate: '', assignedBy: defaultAssignedBy, attachmentUrl: '', attachmentName: '' });
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setShowDialog(true); };

  const openEdit = (hw) => {
    setEditingId(hw.id);
    setForm({
      studentYear: hw.studentYear || '',
      studentClass: hw.studentClass || '',
      section: hw.section || '',
      subject: hw.subject || '',
      title: hw.title || '',
      description: hw.description || '',
      dueDate: hw.dueDate || '',
      assignedBy: hw.assignedBy || defaultAssignedBy,
      attachmentUrl: hw.attachmentUrl || '',
      attachmentName: hw.attachmentName || '',
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateHomework(editingId, form);
        toast.success('Homework updated');
      } else {
        await api.createHomework(form);
        toast.success('Homework assigned');
      }
      setShowDialog(false);
      resetForm();
      loadHomework();
    } catch (error) { toast.error(editingId ? 'Failed to update' : 'Failed to assign homework'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this homework?')) return;
    try { await api.deleteHomework(id); toast.success('Homework deleted'); loadHomework(); }
    catch (error) { toast.error('Failed to delete'); }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: 'Nunito' }}>Homework</h1>
          <p className="text-base font-medium text-slate-600 mt-1" style={{ fontFamily: 'Figtree' }}>Assign and manage homework for classes</p>
        </div>
        {showCreate && (
          <Button data-testid="add-homework-btn" onClick={openCreate} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-transform"><Plus className="w-5 h-5 mr-2" />Assign Homework</Button>
        )}
      </div>

      {/* Shared Create / Edit dialog (mounted when user can create OR edit) */}
      {(showCreate || showEdit) && (<Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-2xl font-bold">{editingId ? 'Edit Homework' : 'Assign Homework'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Year *</Label>
                  <Select value={form.studentYear} onValueChange={(v) => setForm({ ...form, studentYear: v, studentClass: '', section: '' })}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y.id} value={y.yearLabel}>{y.yearLabel}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class *</Label>
                  <Select value={form.studentClass} onValueChange={(v) => setForm({ ...form, studentClass: v, section: '' })} disabled={!form.studentYear}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Class" /></SelectTrigger>
                    <SelectContent>{getClassesForYear(form.studentYear).map((c) => <SelectItem key={c.id} value={c.className}>{c.className}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section *</Label>
                  <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })} disabled={!form.studentClass}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Section" /></SelectTrigger>
                    <SelectContent>{getSections(form.studentYear, form.studentClass).map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Subject *</Label><Input data-testid="hw-subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-xl h-12" placeholder="e.g., Mathematics" /></div>
              <div><Label>Title *</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl h-12" placeholder="Homework title" /></div>
              <div><Label>Description *</Label><textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 min-h-[80px] focus:ring-2 focus:ring-sky-500 focus:border-sky-500" placeholder="Homework details..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Due Date *</Label><Input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded-xl h-12" /></div>
                <div><Label>Assigned By *</Label><Input required value={form.assignedBy} onChange={(e) => setForm({ ...form, assignedBy: e.target.value })} className="rounded-xl h-12 bg-slate-50" placeholder="Teacher name" readOnly={!!defaultAssignedBy} /></div>
              </div>
              <div>
                <Label>Attachment (Optional - PDF/Image)</Label>
                <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  try { const r = await api.uploadFile(file); setForm({ ...form, attachmentUrl: r.data.url, attachmentName: file.name }); toast.success('File uploaded'); }
                  catch (err) { toast.error('Upload failed'); }
                }} className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200" />
                {form.attachmentName && <p className="text-sm text-emerald-600 font-medium mt-1">Attached: {form.attachmentName}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="rounded-xl">Cancel</Button>
                <Button data-testid="submit-homework-btn" type="submit" className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl">{editingId ? 'Update' : 'Assign'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>)}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Year</Label>
            <Select value={filters.studentYear || '_all'} onValueChange={(v) => setFilters({ ...filters, studentYear: v === '_all' ? '' : v, studentClass: '', section: '' })}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All Years</SelectItem>{years.map((y) => <SelectItem key={y.id} value={y.yearLabel}>{y.yearLabel}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Class</Label>
            <Select value={filters.studentClass || '_all'} onValueChange={(v) => setFilters({ ...filters, studentClass: v === '_all' ? '' : v, section: '' })}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All Classes</SelectItem>{getClassesForYear(filters.studentYear).map((c) => <SelectItem key={c.id} value={c.className}>{c.className}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Section</Label>
            <Select value={filters.section || '_all'} onValueChange={(v) => setFilters({ ...filters, section: v === '_all' ? '' : v })}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="_all">All Sections</SelectItem>{getSections(filters.studentYear, filters.studentClass).map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Homework List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div></div>
      ) : homework.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center h-48">
          <p className="text-slate-400 font-medium">No homework assigned yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {homework.map((hw) => (
            <div key={hw.id} data-testid={`homework-${hw.id}`} className={`bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] ${isOverdue(hw.dueDate) ? 'border-rose-200' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {hw.studentYear && <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">{hw.studentYear}</span>}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{hw.studentClass}-{hw.section}</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{hw.subject}</span>
                    {isOverdue(hw.dueDate) && <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">OVERDUE</span>}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{hw.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{hw.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className={`font-bold ${isOverdue(hw.dueDate) ? 'text-rose-600' : 'text-slate-600'}`}>Due: {hw.dueDate}</span>
                    <span>By: {hw.assignedBy}</span>
                    {hw.attachmentUrl && <a href={hw.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-lg font-bold transition-colors">{hw.attachmentName?.endsWith('.pdf') ? 'PDF' : 'File'}</a>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {showEdit && <button onClick={() => openEdit(hw)} data-testid={`edit-homework-${hw.id}`} className="p-2 hover:bg-sky-100 rounded-lg transition-colors" aria-label="Edit homework"><Edit className="w-4 h-4 text-sky-600" /></button>}
                  {showDelete && <button onClick={() => handleDelete(hw.id)} data-testid={`delete-homework-${hw.id}`} className="p-2 hover:bg-rose-100 rounded-lg transition-colors" aria-label="Delete homework"><Trash2 className="w-4 h-4 text-rose-600" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeworkPage;
