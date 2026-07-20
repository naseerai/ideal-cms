import React, { useState, useEffect } from 'react';
import { useAuth, canEdit } from '../lib/AuthContext';
import { Plus, Edit, Trash2, X, BookOpen, Users, LayoutGrid, Loader2, ArrowLeft, CalendarRange } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';

const GRADIENTS = [
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-indigo-400 to-blue-600',
  'from-teal-400 to-cyan-600',
  'from-fuchsia-400 to-purple-600',
];
const gradFor = (s) => GRADIENTS[(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

const Classes = () => {
  const { perms } = useAuth();
  const showEdit = canEdit(perms, 'classes');

  // ----- Years (top level) -----
  const [years, setYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null); // Year object once drilled in
  const [showYearDialog, setShowYearDialog] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [yearLabel, setYearLabel] = useState('');
  const [savingYear, setSavingYear] = useState(false);
  const [deleteYearTarget, setDeleteYearTarget] = useState(null);
  const [deletingYear, setDeletingYear] = useState(false);

  // ----- Classes (within a Year) -----
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [className, setClassName] = useState('');
  const [sectionInput, setSectionInput] = useState('');
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYear) loadClasses(selectedYear.id);
  }, [selectedYear]);

  const loadYears = async () => {
    try {
      const response = await api.getYears();
      setYears(response.data);
    } catch (error) {
      toast.error('Failed to load years');
    } finally {
      setLoadingYears(false);
    }
  };

  const loadClasses = async (yearId) => {
    try {
      setLoadingClasses(true);
      const response = await api.getClasses({ yearId });
      setClasses(response.data);
    } catch (error) {
      toast.error('Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  // ----- Year handlers -----
  const resetYearForm = () => {
    setYearLabel('');
    setEditingYear(null);
  };

  const handleYearSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingYear(true);
      if (editingYear) {
        await api.updateYear(editingYear.id, { yearLabel });
        toast.success('Year updated');
      } else {
        await api.createYear({ yearLabel });
        toast.success('Year added');
      }
      setShowYearDialog(false);
      resetYearForm();
      loadYears();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally { setSavingYear(false); }
  };

  const openEditYear = (y) => {
    setEditingYear(y);
    setYearLabel(y.yearLabel);
    setShowYearDialog(true);
  };

  const confirmDeleteYear = async () => {
    if (!deleteYearTarget) return;
    try {
      setDeletingYear(true);
      await api.deleteYear(deleteYearTarget.id);
      toast.success('Year deleted');
      setDeleteYearTarget(null);
      loadYears();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally { setDeletingYear(false); }
  };

  // ----- Class handlers -----
  const addSection = () => {
    const trimmed = sectionInput.trim().toUpperCase();
    if (trimmed && !sections.includes(trimmed)) {
      setSections([...sections, trimmed]);
      setSectionInput('');
    }
  };

  const removeSection = (s) => setSections(sections.filter((sec) => sec !== s));

  const resetForm = () => {
    setClassName('');
    setSections([]);
    setSectionInput('');
    setEditingClass(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sections.length === 0) {
      toast.error('Add at least one section');
      return;
    }
    try {
      setSaving(true);
      if (editingClass) {
        await api.updateClass(editingClass.id, { yearId: selectedYear.id, className, sections });
        toast.success('Class updated');
      } else {
        await api.createClass({ yearId: selectedYear.id, className, sections });
        toast.success('Class added');
      }
      setShowDialog(false);
      resetForm();
      loadClasses(selectedYear.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const openEdit = (cls) => {
    setEditingClass(cls);
    setClassName(cls.className);
    setSections([...cls.sections]);
    setShowDialog(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteClass(deleteTarget.id);
      toast.success('Class deleted');
      setDeleteTarget(null);
      loadClasses(selectedYear.id);
    } catch (error) {
      toast.error('Failed to delete');
    } finally { setDeleting(false); }
  };

  const totalSections = classes.reduce((s, c) => s + (c.sections?.length || 0), 0);

  // ==================== YEARS LIST VIEW ====================
  if (!selectedYear) {
    return (
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: 'Nunito' }}>
              Academic Years
            </h1>
            <p className="text-base font-medium text-slate-600 mt-1" style={{ fontFamily: 'Figtree' }}>
              Manage admission batches, their classes/courses and sections
            </p>
          </div>
          {showEdit && (<Dialog open={showYearDialog} onOpenChange={(open) => { setShowYearDialog(open); if (!open) resetYearForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-year-btn" className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-md shadow-sky-200">
                <Plus className="w-5 h-5 mr-2" />Add Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{editingYear ? 'Edit Year' : 'Add New Year'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleYearSubmit} className="space-y-4">
                <div>
                  <Label>Year / Batch *</Label>
                  <Input data-testid="year-label-input" required value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} className="rounded-xl h-12" placeholder="e.g., 2024-2027" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setShowYearDialog(false); resetYearForm(); }} className="rounded-xl" disabled={savingYear}>Cancel</Button>
                  <Button data-testid="submit-year-btn" type="submit" disabled={savingYear} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl">
                    {savingYear ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (editingYear ? 'Update' : 'Add Year')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>)}
        </div>

        {loadingYears ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" /></div>
        ) : years.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><CalendarRange className="w-8 h-8 text-slate-400" /></div>
            <p className="text-slate-500 font-medium text-base">No years added yet</p>
            <p className="text-slate-400 text-sm mt-1">Start by adding an admission year/batch, e.g. 2024-2027.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {years.map((y) => {
              const grad = gradFor(y.yearLabel);
              return (
                <div
                  key={y.id}
                  data-testid={`year-card-${y.yearLabel}`}
                  className="group relative bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedYear(y)}
                >
                  <div className={`h-2 bg-gradient-to-r ${grad}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-16 h-16 bg-gradient-to-br ${grad} rounded-2xl flex flex-col items-center justify-center shadow-md flex-shrink-0`}>
                          <CalendarRange className="w-5 h-5 text-white/90" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-lg font-extrabold text-slate-900 leading-tight" style={{ fontFamily: 'Nunito' }}>{y.yearLabel}</p>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Tap to view classes</p>
                        </div>
                      </div>
                      {showEdit && (
                        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openEditYear(y)} data-testid={`edit-year-${y.yearLabel}`} aria-label="Edit year" className="p-2 rounded-lg bg-slate-50 hover:bg-sky-100 text-slate-500 hover:text-sky-600 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteYearTarget(y)} data-testid={`delete-year-${y.yearLabel}`} aria-label="Delete year" className="p-2 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog open={!!deleteYearTarget} onOpenChange={(o) => { if (!o && !deletingYear) setDeleteYearTarget(null); }}>
          <AlertDialogContent data-testid="confirm-delete-year">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Year {deleteYearTarget?.yearLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this year. It must have no classes under it — delete those first. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingYear}>Cancel</AlertDialogCancel>
              <AlertDialogAction data-testid="confirm-delete-year-btn" disabled={deletingYear} onClick={(e) => { e.preventDefault(); confirmDeleteYear(); }} className="bg-rose-500 hover:bg-rose-600">
                {deletingYear ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : 'Yes, Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ==================== CLASSES (WITHIN A YEAR) VIEW ====================
  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => setSelectedYear(null)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 hover:text-sky-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />Back to Years
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: 'Nunito' }}>
            {selectedYear.yearLabel} — Classes &amp; Sections
          </h1>
          <p className="text-base font-medium text-slate-600 mt-1" style={{ fontFamily: 'Figtree' }}>
            Manage classes/courses and their sections for this year
          </p>
        </div>
        {showEdit && (<Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="add-class-btn" className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl active:scale-95 transition-transform shadow-md shadow-sky-200">
              <Plus className="w-5 h-5 mr-2" />Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Class / Course Name *</Label>
                <Input data-testid="class-name-input" required value={className} onChange={(e) => setClassName(e.target.value)} className="rounded-xl h-12" placeholder="e.g., B.Sc Honours, B.A. English" />
              </div>
              <div>
                <Label>Sections *</Label>
                <div className="flex gap-2 mt-2">
                  <Input data-testid="section-input" value={sectionInput} onChange={(e) => setSectionInput(e.target.value)} className="rounded-xl h-12" placeholder="e.g., A" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }} />
                  <Button type="button" onClick={addSection} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl h-12 active:scale-95 transition-transform">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {sections.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-amber-100 text-amber-800">
                      {s}
                      <button type="button" onClick={() => removeSection(s)} className="hover:text-rose-600 transition-colors"><X className="w-4 h-4" /></button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => { setShowDialog(false); resetForm(); }} className="rounded-xl" disabled={saving}>Cancel</Button>
                <Button data-testid="submit-class-btn" type="submit" disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl">
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (editingClass ? 'Update' : 'Add Class')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>)}
      </div>

      {/* Stats strip */}
      {!loadingClasses && classes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-sky-600" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Classes</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{classes.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center"><LayoutGrid className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sections</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalSections}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3 col-span-2 sm:col-span-2">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center"><Users className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg sections per class</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{classes.length ? (totalSections / classes.length).toFixed(1) : 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loadingClasses ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" /></div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><BookOpen className="w-8 h-8 text-slate-400" /></div>
          <p className="text-slate-500 font-medium text-base">No classes added yet</p>
          <p className="text-slate-400 text-sm mt-1">Start by adding a class/course &amp; its sections.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map((cls) => {
            const grad = gradFor(cls.className);
            return (
              <div
                key={cls.id}
                data-testid={`class-card-${cls.className}`}
                className="group relative bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                {/* Decorative top band */}
                <div className={`h-2 bg-gradient-to-r ${grad}`} />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-16 h-16 bg-gradient-to-br ${grad} rounded-2xl flex flex-col items-center justify-center shadow-md flex-shrink-0 p-1`}>
                        <BookOpen className="w-3.5 h-3.5 text-white/80" />
                        <span className="text-white font-extrabold text-xs leading-tight mt-0.5 text-center" style={{ fontFamily: 'Nunito' }}>{cls.className}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />{cls.sections.length} section{cls.sections.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {showEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(cls)} data-testid={`edit-class-${cls.className}`} aria-label="Edit class" className="p-2 rounded-lg bg-slate-50 hover:bg-sky-100 text-slate-500 hover:text-sky-600 transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteTarget(cls)} data-testid={`delete-class-${cls.className}`} aria-label="Delete class" className="p-2 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>

                  {/* Sections */}
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Sections</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cls.sections.map((s) => (
                        <span key={s} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="confirm-delete-class">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class {deleteTarget?.className}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove Class {deleteTarget?.className} and its {deleteTarget?.sections?.length || 0} section(s). Students currently assigned to it will need to be re-assigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-class-btn" disabled={deleting} onClick={(e) => { e.preventDefault(); confirmDelete(); }} className="bg-rose-500 hover:bg-rose-600">
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Classes;
