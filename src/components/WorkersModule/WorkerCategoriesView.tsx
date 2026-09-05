import React, { useState, useMemo } from 'react';
import { WorkerProfile, WorkerCategoryDef } from '../../types';
import { 
  Briefcase, Plus, Users, Tag, Check, ChevronRight, 
  Search, Shield, Layers, UserCheck, Sparkles, Edit3, Trash2, AlertTriangle
} from 'lucide-react';

interface WorkerCategoriesViewProps {
  workers: WorkerProfile[];
  categoriesList: WorkerCategoryDef[];
  departmentsList: string[];
  onAddCategory: (category: WorkerCategoryDef) => Promise<void>;
  onUpdateCategory?: (category: WorkerCategoryDef) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  onEditWorker: (worker: WorkerProfile) => void;
  onViewQrPass: (worker: WorkerProfile) => void;
}

export const WorkerCategoriesView: React.FC<WorkerCategoriesViewProps> = ({
  workers,
  categoriesList,
  departmentsList,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onEditWorker,
  onViewQrPass
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDept, setNewCatDept] = useState('Adult');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState<WorkerCategoryDef | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDept, setEditCatDept] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  // Delete Category State
  const [deletingCategory, setDeletingCategory] = useState<WorkerCategoryDef | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Department counts
  const deptStats = useMemo(() => {
    const map = new Map<string, number>();
    departmentsList.forEach(d => map.set(d, 0));
    workers.forEach(w => {
      const current = map.get(w.department) || 0;
      map.set(w.department, current + 1);
    });
    return map;
  }, [departmentsList, workers]);

  // Categories filtered by department
  const filteredCategories = useMemo(() => {
    return categoriesList.filter(cat => {
      const matchesDept = selectedDept === 'ALL' || cat.department === selectedDept;
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        (cat.name || '').toLowerCase().includes(q) ||
        (cat.department || '').toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [categoriesList, selectedDept, searchQuery]);

  // Workers assigned to currently selected category
  const workersInSelectedCategory = useMemo(() => {
    if (!selectedCategoryName) return [];
    return workers.filter(w => w.categories.includes(selectedCategoryName));
  }, [workers, selectedCategoryName]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newDef: WorkerCategoryDef = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      department: newCatDept,
      description: newCatDesc.trim() || undefined,
      isStandard: false
    };

    await onAddCategory(newDef);
    setNewCatName('');
    setNewCatDesc('');
    setShowAddModal(false);
  };

  const handleOpenEdit = (cat: WorkerCategoryDef, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatDept(cat.department);
    setEditCatDesc(cat.description || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim() || !onUpdateCategory) return;

    const updated: WorkerCategoryDef = {
      ...editingCategory,
      name: editCatName.trim(),
      department: editCatDept,
      description: editCatDesc.trim() || undefined
    };

    await onUpdateCategory(updated);
    if (selectedCategoryName === editingCategory.name) {
      setSelectedCategoryName(updated.name);
    }
    setShowEditModal(false);
    setEditingCategory(null);
  };

  const handleOpenDelete = (cat: WorkerCategoryDef, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingCategory(cat);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory || !onDeleteCategory) return;

    await onDeleteCategory(deletingCategory.id);
    if (selectedCategoryName === deletingCategory.name) {
      setSelectedCategoryName(null);
    }
    setShowDeleteModal(false);
    setDeletingCategory(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded-full text-xs font-black uppercase tracking-wider">
              Organizational Hierarchy
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              Roles & Departments Architecture
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cinzel',serif] tracking-tight mt-1">
            Worker Categories & Ministry Roles
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mt-1">
            Configure ministerial offices, standard assignments, and cross-departmental multi-role portfolios.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition self-start md:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Add New Role / Category</span>
        </button>
      </div>

      {/* Department Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          onClick={() => { setSelectedDept('ALL'); setSelectedCategoryName(null); }}
          className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
            selectedDept === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">All Ministries</span>
          <div className="text-2xl font-black mt-2">{workers.length} Workers</div>
          <span className="text-[11px] opacity-70 mt-1">{categoriesList.length} defined roles</span>
        </button>

        {departmentsList.map(dept => {
          const count = deptStats.get(dept) || 0;
          const isSelected = selectedDept === dept;
          return (
            <button
              key={dept}
              onClick={() => { setSelectedDept(dept); setSelectedCategoryName(null); }}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-950 text-white border-blue-950 shadow-md'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
              }`}
            >
              <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-amber-300' : 'text-blue-900'}`}>
                {dept}
              </span>
              <div className="text-2xl font-black mt-2">{count}</div>
              <span className="text-[11px] opacity-70 mt-1">
                {categoriesList.filter(c => c.department === dept).length} roles defined
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Layout Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Categories List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search roles or categories..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <span className="text-xs text-slate-500 font-semibold shrink-0">
              {filteredCategories.length} Roles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredCategories.map(cat => {
              const count = workers.filter(w => w.categories.includes(cat.name)).length;
              const isSelected = selectedCategoryName === cat.name;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategoryName(cat.name)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50 border-2 border-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                        {cat.department}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-950 text-[10px] font-black rounded-full">
                          {count} {count === 1 ? 'Worker' : 'Workers'}
                        </span>
                        {onUpdateCategory && (
                          <button
                            onClick={(e) => handleOpenEdit(cat, e)}
                            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-blue-900 rounded-md transition"
                            title="Edit / Rename Role"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteCategory && (
                          <button
                            onClick={(e) => handleOpenDelete(cat, e)}
                            className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-md transition"
                            title="Delete Role"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm pt-1">
                      {cat.name}
                    </h3>

                    {cat.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-blue-900">
                    <span>View Roster</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Right Column: Workers Assigned to Selected Category */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col">
          
          <div className="border-b border-slate-200 pb-3 mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Role Roster View
            </span>
            <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
              {selectedCategoryName ? selectedCategoryName : 'Select a Role'}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedCategoryName 
                ? `${workersInSelectedCategory.length} workers hold this role`
                : 'Click any role card on the left to see all workers assigned to it.'}
            </p>
          </div>

          {!selectedCategoryName ? (
            <div className="my-auto p-8 text-center text-xs text-slate-400">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              Select a category to view assigned personnel
            </div>
          ) : workersInSelectedCategory.length === 0 ? (
            <div className="my-auto p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
              No workers currently assigned to "{selectedCategoryName}".
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
              {workersInSelectedCategory.map(w => (
                <div
                  key={w.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-2 transition"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {w.fullName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {w.phone} • {w.department}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onViewQrPass(w)}
                      className="p-1.5 bg-white border border-slate-300 hover:bg-blue-50 text-slate-700 rounded-lg text-xs"
                      title="View QR Code"
                    >
                      QR
                    </button>
                    <button
                      onClick={() => onEditWorker(w)}
                      className="p-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs"
                      title="Edit Roles"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Add New Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                Add New Role / Category
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Associate Praise Leader, Deputy Chief Usher..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Primary Ministry / Department
                </label>
                <select
                  value={newCatDept}
                  onChange={e => setNewCatDept(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-bold bg-white"
                >
                  {departmentsList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Description / Responsibilities (Optional)
                </label>
                <textarea
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  rows={3}
                  placeholder="Brief summary of duties..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-black"
                >
                  Create Role
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-900" />
                <span>Edit Role / Category</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={e => setEditCatName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Department / Ministry
                </label>
                <select
                  value={editCatDept}
                  onChange={e => setEditCatDept(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-bold bg-white"
                >
                  {departmentsList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={editCatDesc}
                  onChange={e => setEditCatDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-black"
                >
                  Save Changes
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {showDeleteModal && deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-red-200 space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 font-['Cinzel',serif]">
                  Delete Category "{deletingCategory.name}"?
                </h3>
                <p className="text-xs text-slate-500">
                  {workers.filter(w => w.categories.includes(deletingCategory.name)).length} worker(s) currently hold this category.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              Removing this role will unassign it from all existing workers without deleting worker profiles.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-sm"
              >
                Delete Role
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
