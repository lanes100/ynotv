import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    listFailoverGroups,
    createFailoverGroup,
    deleteFailoverGroup,
    renameFailoverGroup,
} from '../services/failover-groups';
import { FailoverGroupManager } from './FailoverGroupManager';
import './FailoverGroupListModal.css';

interface FailoverGroupListModalProps {
    onClose: () => void;
}

interface FailoverGroupItem {
    group_id: string;
    name: string;
    memberCount: number;
    created_at: number;
}

export function FailoverGroupListModal({ onClose }: FailoverGroupListModalProps) {
    const [groups, setGroups] = useState<FailoverGroupItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [managingGroup, setManagingGroup] = useState<{ id: string; name: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const newNameInputRef = useRef<HTMLInputElement>(null);
    const editNameInputRef = useRef<HTMLInputElement>(null);

    const loadGroups = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listFailoverGroups();
            setGroups(data);
        } catch (e) {
            console.error('Failed to load failover groups:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    useEffect(() => {
        if (creating) {
            setTimeout(() => newNameInputRef.current?.focus(), 50);
        }
    }, [creating]);

    useEffect(() => {
        if (editingId) {
            setTimeout(() => editNameInputRef.current?.select(), 50);
        }
    }, [editingId]);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        try {
            await createFailoverGroup(trimmed);
            setNewName('');
            setCreating(false);
            await loadGroups();
        } catch (e) {
            console.error('Failed to create group:', e);
        }
    };

    const handleDelete = async (groupId: string) => {
        try {
            await deleteFailoverGroup(groupId);
            setDeleteConfirmId(null);
            await loadGroups();
        } catch (e) {
            console.error('Failed to delete group:', e);
        }
    };

    const startEdit = (group: FailoverGroupItem) => {
        setEditingId(group.group_id);
        setEditName(group.name);
    };

    const commitEdit = async () => {
        if (!editingId) return;
        const trimmed = editName.trim();
        if (trimmed) {
            try {
                await renameFailoverGroup(editingId, trimmed);
                await loadGroups();
            } catch (e) {
                console.error('Failed to rename group:', e);
            }
        }
        setEditingId(null);
    };

    const handleEditKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') setEditingId(null);
    };

    const handleNewNameKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') {
            setCreating(false);
            setNewName('');
        }
    };

    return (
        <>
            <div className="failover-group-list-overlay" onClick={onClose}>
                <div className="failover-group-list-modal" onClick={e => e.stopPropagation()}>
                    <div className="failover-group-list-header">
                        <h2>Failover Groups</h2>
                        <button className="close-btn" onClick={onClose}>✕</button>
                    </div>

                    <div className="failover-group-list-content">
                        <div className="failover-group-list-toolbar">
                            {!creating ? (
                                <button className="fgl-create-btn" onClick={() => setCreating(true)}>
                                    <span>＋</span> Create New Group
                                </button>
                            ) : (
                                <div className="fgl-create-row">
                                    <input
                                        ref={newNameInputRef}
                                        className="fgl-create-input"
                                        placeholder="Group name…"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={handleNewNameKey}
                                        onBlur={() => {
                                            if (!newName.trim()) {
                                                setCreating(false);
                                            }
                                        }}
                                    />
                                    <button className="fgl-create-ok" onClick={handleCreate}>Create</button>
                                    <button className="fgl-create-cancel" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <div className="fgl-empty">Loading…</div>
                        ) : groups.length === 0 ? (
                            <div className="fgl-empty">
                                <p>No failover groups yet.</p>
                                <p className="fgl-hint">Create a group to manage backup channels for failover.</p>
                            </div>
                        ) : (
                            <div className="fgl-list">
                                {groups.map(group => (
                                    <div key={group.group_id} className="fgl-item">
                                        {editingId === group.group_id ? (
                                            <div className="fgl-edit-row">
                                                <input
                                                    ref={editNameInputRef}
                                                    className="fgl-edit-input"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onKeyDown={handleEditKey}
                                                    onBlur={commitEdit}
                                                />
                                                <button className="fgl-edit-ok" onClick={commitEdit}>✓</button>
                                            </div>
                                        ) : (
                                            <div className="fgl-item-main" onClick={() => setManagingGroup({ id: group.group_id, name: group.name })}>
                                                <div className="fgl-item-info">
                                                    <span className="fgl-item-name">{group.name}</span>
                                                    <span className="fgl-item-count">{group.memberCount} channel{group.memberCount !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className="fgl-item-actions" onClick={e => e.stopPropagation()}>
                                                    <button className="fgl-action-btn" onClick={() => startEdit(group)} title="Rename">✏️</button>
                                                    {deleteConfirmId === group.group_id ? (
                                                        <>
                                                            <button className="fgl-action-btn fgl-confirm" onClick={() => handleDelete(group.group_id)} title="Confirm delete">✓</button>
                                                            <button className="fgl-action-btn" onClick={() => setDeleteConfirmId(null)} title="Cancel">✕</button>
                                                        </>
                                                    ) : (
                                                        <button className="fgl-action-btn fgl-danger" onClick={() => setDeleteConfirmId(group.group_id)} title="Delete">🗑️</button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="failover-group-list-footer">
                        <span className="fgl-footer-hint">Click a group to manage its channels</span>
                        <button className="close-done-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>

            {managingGroup && (
                <FailoverGroupManager
                    groupId={managingGroup.id}
                    groupName={managingGroup.name}
                    onClose={() => {
                        setManagingGroup(null);
                        loadGroups();
                    }}
                />
            )}
        </>
    );
}
