"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSuccessMessage } from '@/lib/hooks/useSuccessMessage';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGrid from '@/components/admin/AdminGrid';

export default function AdminPoseManager({ adminToken, timedOnly = false }) {
  const [poses, setPoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccess] = useSuccessMessage();

  // Form state (custom due to image upload)
  const [showForm, setShowForm] = useState(false);
  const [editingPose, setEditingPose] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    instruction: '',
    points: 10,
    startTime: '',
    endTime: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchPoses();
  }, []);

  const fetchPoses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/poses');
      const data = await res.json();

      if (data?.success) {
        // Defensive: Filter poses based on timedOnly prop
        const allPoses = Array.isArray(data.data) ? data.data : [];
        const filteredPoses = allPoses.filter(pose => {
          const hasTimeWindow = pose?.startTime && pose?.endTime;
          return timedOnly ? hasTimeWindow : !hasTimeWindow;
        });
        setPoses(filteredPoses);
      } else {
        setPoses([]);
      }
    } catch (err) {
      console.error('[AdminPoseManager] Error fetching poses:', err);
      setPoses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const openAddForm = () => {
    setEditingPose(null);
    setFormData({ title: '', instruction: '', points: 10, startTime: '', endTime: '' });
    setImageFile(null);
    setImagePreview(null);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (pose) => {
    setEditingPose(pose);

    // Format datetime for input (datetime-local requires format: YYYY-MM-DDTHH:MM)
    const formatDateTime = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().slice(0, 16);
    };

    setFormData({
      title: pose.title || '',
      instruction: pose.instruction || '',
      points: pose.points ?? 10,
      startTime: formatDateTime(pose.startTime),
      endTime: formatDateTime(pose.endTime),
    });
    setImagePreview(pose.image);
    setImageFile(null);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPose(null);
    setFormData({ title: '', instruction: '', points: 10, startTime: '', endTime: '' });
    setImageFile(null);
    setImagePreview(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const formDataToSend = new FormData();

      if (editingPose) {
        formDataToSend.append('id', editingPose.id);
      }

      formDataToSend.append('title', formData.title);
      formDataToSend.append('instruction', formData.instruction);
      formDataToSend.append('points', formData.points || 10);

      // Only add time window for timed challenges
      if (timedOnly) {
        if (formData.startTime) {
          formDataToSend.append('startTime', new Date(formData.startTime).toISOString());
        }
        if (formData.endTime) {
          formDataToSend.append('endTime', new Date(formData.endTime).toISOString());
        }
      }

      if (imageFile) {
        formDataToSend.append('image', imageFile);
      } else if (!editingPose) {
        setFormError('Image is required for new poses');
        setFormLoading(false);
        return;
      }

      const method = editingPose ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/poses', {
        method,
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        body: formDataToSend,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(editingPose ? 'Pose updated successfully!' : 'Pose created successfully!');
        fetchPoses();
        closeForm();
      } else {
        // Provide specific error messages
        let errorMsg = data?.error || 'Failed to save pose';
        if (res.status === 401) {
          errorMsg = 'Your admin session has expired. Please refresh and log in again.';
        } else if (res.status === 409) {
          errorMsg = `A pose with this title already exists. Please choose a different title.`;
        } else if (errorMsg.includes('file type')) {
          errorMsg = 'Only PNG and JPEG images are allowed.';
        } else if (errorMsg.includes('size')) {
          errorMsg = 'Image file must be smaller than 5MB.';
        }
        setFormError(errorMsg);
      }
    } catch (err) {
      console.error('[AdminPoseManager] Error saving pose:', err);
      setFormError('Failed to save pose. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (pose) => {
    if (!confirm(`Delete "${pose.title}" pose? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/poses?id=${pose.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Pose deleted successfully!');
        fetchPoses();
      } else {
        alert('Failed to delete pose: ' + (data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('[AdminPoseManager] Error deleting pose:', err);
      alert('Failed to delete pose');
    }
  };

  const movePose = async (index, direction) => {
    const newPoses = [...poses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newPoses.length) {
      return; // Can't move beyond bounds
    }

    // Swap poses
    [newPoses[index], newPoses[targetIndex]] = [newPoses[targetIndex], newPoses[index]];

    // Update local state immediately for responsive UI
    setPoses(newPoses);

    // Send reorder request to server
    try {
      const reorderedPoses = newPoses.map((pose, idx) => ({
        id: pose.id,
        order: idx,
      }));

      const res = await fetch('/api/admin/poses/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ poses: reorderedPoses }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Pose order updated!');
      } else {
        // Revert on error
        fetchPoses();
        alert('Failed to reorder poses: ' + (data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('[AdminPoseManager] Error reordering poses:', err);
      // Revert on error
      fetchPoses();
      alert('Failed to reorder poses');
    }
  };

  return (
    <AdminLayout
      title={timedOnly ? 'Timed Challenge Manager' : 'Pose Challenge Manager'}
      actions={
        <button className="btn" onClick={openAddForm}>
          + Add New Pose
        </button>
      }
    >
      {successMessage && (
        <div className="success-banner">
          {successMessage}
        </div>
      )}

      <AdminGrid
        items={poses}
        loading={loading}
        emptyMessage={timedOnly ? "No timed challenges yet. Create one to get started!" : "No poses yet. Create one to get started!"}
        emptyIcon="🎯"
      >
        {(pose, index) => (
          <div key={pose.id} className="pose-card-admin card">
            <div className="pose-image-container">
              <Image
                src={pose.image}
                alt={pose.title}
                fill
                unoptimized
                className="pose-image"
              />
              <div className="pose-reorder-controls">
                <button
                  className="reorder-btn"
                  onClick={() => movePose(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  className="reorder-btn"
                  onClick={() => movePose(index, 'down')}
                  disabled={index === (poses?.length ?? 0) - 1}
                  title="Move down"
                >
                  ▼
                </button>
              </div>
            </div>
            <div className="pose-card-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontWeight: '500', margin: 0 }}>
                  {pose.title}
                </h3>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '0.25rem',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                }}>
                  🏆 {pose.points || 10} pts
                </span>
              </div>
              <p className="pose-instruction-preview">
                {pose.instruction}
              </p>
              <div className="pose-card-actions">
                <button
                  className="btn-edit"
                  onClick={() => openEditForm(pose)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(pose)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminGrid>

      {/* Pose Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="pose-form-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontWeight: '400', marginBottom: '0' }}>
                {editingPose ? 'Edit Pose' : 'Add New Pose'}
              </h2>
              <button className="modal-close" onClick={closeForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="pose-form">
              <div className="form-row">
                <div className="form-column">
                  <div className="form-group">
                    <label className="form-label">Pose Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="e.g., The Romantic Dip"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Instruction *</label>
                    <textarea
                      className="form-textarea"
                      value={formData.instruction}
                      onChange={(e) =>
                        setFormData({ ...formData, instruction: e.target.value })
                      }
                      placeholder="Describe the pose challenge..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Points (0-100)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.points}
                      onChange={(e) =>
                        setFormData({ ...formData, points: parseInt(e.target.value) || 0 })
                      }
                      min="0"
                      max="100"
                      placeholder="10"
                    />
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                      Points awarded when guests complete this challenge
                    </p>
                  </div>

                  {/* Only show Time Window for Timed Challenges */}
                  {timedOnly && (
                    <div className="form-group">
                      <label className="form-label">⏰ Time Window *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Start Time</label>
                          <input
                            type="datetime-local"
                            className="form-input"
                            value={formData.startTime}
                            onChange={(e) =>
                              setFormData({ ...formData, startTime: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>End Time</label>
                          <input
                            type="datetime-local"
                            className="form-input"
                            value={formData.endTime}
                            onChange={(e) =>
                              setFormData({ ...formData, endTime: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                        Challenge only active during this time window.
                      </p>
                    </div>
                  )}
                </div>

                <div className="form-column">
                  <div className="form-group">
                    <label className="form-label">
                      Pose Image {!editingPose && '*'}
                    </label>
                    <div
                      className="image-drop-zone"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                    >
                      {imagePreview ? (
                        <div className="image-preview">
                          <img src={imagePreview} alt="Preview" />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                          >
                            ✕ Remove
                          </button>
                        </div>
                      ) : (
                        <div className="drop-zone-placeholder">
                          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                            📸
                          </div>
                          <p>Drag & drop image here</p>
                          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                            or click to browse
                          </p>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                            id="image-upload"
                          />
                          <label htmlFor="image-upload" className="upload-label-btn">
                            Choose File
                          </label>
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                      PNG or JPEG, max 5MB
                    </p>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="error-message">
                  {formError}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={formLoading}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn"
                >
                  {formLoading ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      Saving...
                    </>
                  ) : (
                    editingPose ? '✓ Update Pose' : '+ Create Pose'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
