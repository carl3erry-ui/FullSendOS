"use client";

import React, { useState, useEffect } from "react";
import { FileReferenceSafe } from "@/schemas/client-data-room";

interface DataRoomFile extends FileReferenceSafe {
  description?: string;
  tags: string[];
}

interface DataRoomFolder {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  sortOrder: number;
  isSystem: boolean;
}

interface DataRoomPanelProps {
  engagementId: string;
  initialFiles?: DataRoomFile[];
  initialFolders?: DataRoomFolder[];
  disableAutoLoad?: boolean;
  initialShowUpload?: boolean;
}

export function DataRoomPanel({
  engagementId,
  initialFiles = [],
  initialFolders = [],
  disableAutoLoad = false,
  initialShowUpload = false,
}: DataRoomPanelProps) {
  const [files, setFiles] = useState<DataRoomFile[]>(initialFiles);
  const [folders, setFolders] = useState<DataRoomFolder[]>(initialFolders);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [loading, setLoading] = useState(!disableAutoLoad);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(initialShowUpload);

  useEffect(() => {
    if (disableAutoLoad) return;
    loadFoldersAndFiles();
  }, [engagementId, disableAutoLoad]);

  useEffect(() => {
    if (disableAutoLoad) return;
    loadFiles(selectedFolderId === "all" ? undefined : selectedFolderId);
  }, [selectedFolderId, disableAutoLoad]);

  const loadFoldersAndFiles = async () => {
    await Promise.all([loadFolders(), loadFiles()]);
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(`/api/engagements/${engagementId}/data-room/folders`);
      if (!response.ok) throw new Error("Failed to load folders");
      const data = await response.json();
      const sorted = Array.isArray(data.folders)
        ? [...data.folders].sort((a, b) => a.sortOrder - b.sortOrder)
        : [];
      setFolders(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const loadFiles = async (folderId?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      const query = params.toString();
      const response = await fetch(
        `/api/engagements/${engagementId}/data-room${query ? `?${query}` : ""}`
      );
      if (!response.ok) throw new Error("Failed to load files");
      const data = await response.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch(
        `/api/engagements/${engagementId}/data-room`,
        {
          method: "POST",
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      await loadFiles();
      setShowUpload(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Archive this file?")) return;

    try {
      const response = await fetch(
        `/api/engagements/${engagementId}/data-room/${fileId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Delete failed");
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="data-room-panel">
      <div className="data-room-header">
        <div>
          <h3>Client Data Room</h3>
          <p className="text-sm text-gray-600">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="btn btn-sm btn-primary"
        >
          {showUpload ? "Cancel" : "+ Upload"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showUpload && (
        <form onSubmit={handleUpload} className="data-room-upload-form">
          <div className="form-group">
            <label htmlFor="file">Select file</label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.jpg,.png,.gif"
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">File type</label>
            <select
              id="type"
              name="type"
              defaultValue="other"
              disabled={uploading}
            >
              <option value="document">Document</option>
              <option value="research">Research</option>
              <option value="contract">Contract</option>
              <option value="financial">Financial</option>
              <option value="correspondence">Correspondence</option>
              <option value="media">Media</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="folderId">Folder</label>
            <select
              id="folderId"
              name="folderId"
              defaultValue="misc"
              disabled={uploading}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Add context about this file..."
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags (comma-separated, optional)</label>
            <input
              id="tags"
              name="tags"
              type="text"
              placeholder="e.g., research, Q1, confidential"
              disabled={uploading}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="empty-state">
          <p>No files uploaded yet</p>
        </div>
      ) : (
        <>
          <div className="folder-filter-row">
            <label htmlFor="folder-filter">Folder</label>
            <select
              id="folder-filter"
              value={selectedFolderId}
              onChange={(event) => setSelectedFolderId(event.target.value)}
            >
              <option value="all">All folders</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <div className="data-room-file-list">
            {files.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-meta">
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <span className="file-type">{file.type}</span>
                    <span className="file-date">{formatDate(file.uploadedAt)}</span>
                  </div>
                  {file.description && (
                    <div className="file-description">{file.description}</div>
                  )}
                  {file.tags && file.tags.length > 0 && (
                    <div className="file-tags">
                      {file.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="btn btn-sm btn-ghost"
                  aria-label="Delete file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .data-room-panel {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        .data-room-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .data-room-header h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .data-room-header .text-sm {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .data-room-upload-form {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: #374151;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .form-group input:disabled,
        .form-group textarea:disabled,
        .form-group select:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-primary:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
        }

        .btn-ghost {
          background-color: transparent;
          color: #6b7280;
        }

        .btn-ghost:hover {
          background-color: #f3f4f6;
          color: #374151;
        }

        .alert {
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }

        .alert-error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .loading,
        .empty-state {
          padding: 2rem 1rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .data-room-file-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .folder-filter-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .folder-filter-row label {
          font-size: 0.875rem;
          color: #374151;
          font-weight: 500;
        }

        .folder-filter-row select {
          min-width: 220px;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          background: white;
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0.75rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          font-weight: 500;
          color: #1f2937;
          word-break: break-word;
          margin-bottom: 0.25rem;
        }

        .file-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: #9ca3af;
          margin-bottom: 0.5rem;
        }

        .file-description {
          font-size: 0.8125rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .file-tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tag {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          background-color: #e0e7ff;
          color: #3730a3;
          border-radius: 3px;
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
