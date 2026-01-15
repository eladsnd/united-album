"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function AdminPoseManager({ adminToken, onLogout }) {
    const [poses, setPoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPose, setEditingPose] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        instruction: '',
        folderId: '',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchPoses();
    }, []);

    const fetchPoses = async () => {
        try {
            const res = await fetch('/api/admin/poses');
            const data = await res.json();
            if (data.success) {
                setPoses(data.data);
            }
        } catch (err) {
            console.error('[AdminPoseManager] Error fetching poses:', err);
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
        setFormData({ title: '', instruction: '', folderId: '' });
        setImageFile(null);
        setImagePreview(null);
        setFormError('');
        setShowForm(true);
    };

    const openEditForm = (pose) => {
        setEditingPose(pose);
        setFormData({
            title: pose.title,
            instruction: pose.instruction,
            folderId: pose.folderId || '',
        });
        setImagePreview(pose.image);
        setImageFile(null);
        setFormError('');
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingPose(null);
        setFormData({ title: '', instruction: '', folderId: '' });
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
            if (formData.folderId) {
                formDataToSend.append('folderId', formData.folderId);
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
                setSuccessMessage(editingPose ? 'Pose updated successfully!' : 'Pose created successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
                fetchPoses();
                closeForm();
            } else {
                setFormError(data.error || 'Failed to save pose');
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
                setSuccessMessage('Pose deleted successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
                fetchPoses();
            } else {
                alert('Failed to delete pose: ' + data.error);
            }
        } catch (err) {
            console.error('[AdminPoseManager] Error deleting pose:', err);
            alert('Failed to delete pose');
        }
    };

    return (
        <div className="admin-pose-manager">
            <div className="admin-header">
                <div className="admin-header-content">
                    <h1 style={{ fontWeight: '400', marginBottom: '0.5rem' }}>
                        Pose Challenge Manager
                    </h1>
                    <div className="admin-badge">Administrator</div>
                </div>
                <div className="admin-header-actions">
                    <button className="btn" onClick={openAddForm}>
                        + Add New Pose
                    </button>
                    <button className="btn-secondary" onClick={onLogout}>
                        Sign Out
                    </button>
                </div>
            </div>

            {successMessage && (
                <div className="success-banner">
                    {successMessage}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <span className="animate-spin" style={{ fontSize: '2rem' }}>⟳</span>
                    <p style={{ marginTop: '1rem', opacity: 0.6 }}>Loading poses...</p>
                </div>
            ) : (
                <div className="pose-manager-grid">
                    {poses.map((pose) => (
                        <div key={pose.id} className="pose-card-admin card">
                            <div className="pose-image-container">
                                <Image
                                    src={pose.image}
                                    alt={pose.title}
                                    fill
                                    unoptimized
                                    className="pose-image"
                                />
                            </div>
                            <div className="pose-card-content">
                                <h3 style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                                    {pose.title}
                                </h3>
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
                    ))}
                </div>
            )}

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
                                        <label className="form-label">Folder ID (Optional)</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.folderId}
                                            onChange={(e) =>
                                                setFormData({ ...formData, folderId: e.target.value })
                                            }
                                            placeholder="Google Drive folder ID"
                                        />
                                    </div>
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
                                                            setImagePreview(editingPose ? editingPose.image : null);
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
                                    className="btn-secondary"
                                    onClick={closeForm}
                                    disabled={formLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={formLoading}
                                >
                                    {formLoading ? (
                                        <>
                                            <span className="animate-spin">⟳</span>
                                            Saving...
                                        </>
                                    ) : (
                                        editingPose ? 'Update Pose' : 'Create Pose'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
