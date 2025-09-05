import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Alert, Badge, Spinner, Modal } from 'react-bootstrap';
import axios from 'axios';
import './design.css';
import './App.css';

const RecordingsList = ({ refreshKey, apiUrl }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchRecordings();
  }, [refreshKey, apiUrl]);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${apiUrl}/api/recordings`, {
        timeout: 10000
      });
      setRecordings(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      if (error.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Please ensure the backend is running on port 5000.');
      } else if (error.response) {
        setError(`Server error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
      } else {
        setError('Failed to load recordings. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileName = (filename) => {
    const parts = filename.split('-');
    if (parts.length >= 2) {
      const timestamp = new Date(parseInt(parts[1]));
      if (!isNaN(timestamp.getTime())) {
        return `Recording ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    return filename.replace('.webm', '');
  };

  const playRecording = (recording) => {
    setSelectedRecording(recording);
    setShowModal(true);
  };

  const downloadRecording = (recording) => {
    const url = `${apiUrl}/api/recordings/${recording.id}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = recording.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedRecording(null);
  };

  // Calculate total size for footer
  const totalSize = recordings.reduce((sum, recording) => sum + recording.size, 0);

  if (loading) {
    return (
      <Card className="main-card">
        <Card.Header className="card-header-custom">
          <h4 className="card-title">📁 My Recordings</h4>
        </Card.Header>
        <Card.Body className="card-body-custom text-center">
          <div className="loading-state">
            <Spinner animation="border" role="status" className="spinner-custom mb-3">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="loading-text">Loading your recordings...</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card className="main-card">
        <Card.Header className="card-header-custom">
          <div className="header-content">
            <div>
              <h4 className="card-title">📁 My Recordings</h4>
              <p className="card-subtitle">Manage and view your screen recordings</p>
            </div>
            <div className="header-actions">
              <Badge className="count-badge">
                {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
              </Badge>
              <Button 
                className="btn-custom btn-secondary btn-sm"
                onClick={fetchRecordings}
                disabled={loading}
              >
                <span className="btn-icon">🔄</span>
                Refresh
              </Button>
            </div>
          </div>
        </Card.Header>
        
        <Card.Body className="card-body-custom p-0">
          {error && (
            <div className="m-4">
              <Alert className="alert-custom alert-error">
                <div className="alert-content">
                  <span className="alert-icon">⚠️</span>
                  <div>
                    <strong>Connection Issue</strong>
                    <p className="mb-2">{error}</p>
                    <Button className="btn-custom btn-secondary btn-sm" onClick={fetchRecordings}>
                      <span className="btn-icon">🔄</span>
                      Try Again
                    </Button>
                  </div>
                </div>
              </Alert>
            </div>
          )}
          
          {recordings.length === 0 && !error ? (
            <div className="empty-state">
              <div className="empty-icon">📹</div>
              <h5 className="empty-title">No recordings yet</h5>
              <p className="empty-subtitle">
                Start by recording your screen, then upload it to see it in this list!
              </p>
            </div>
          ) : (
            <div className="table-container">
              <Table className="table-custom">
                {/* Table Caption */}
                <caption className="table-caption">
                  A list of your recent screen recordings
                </caption>
                
                {/* Table Header */}
                <thead className="table-header">
                  <tr>
                    <th className="col-recording">🎬 Recording</th>
                    <th className="col-status">📊 Status</th>
                    <th className="col-size">📏 Size</th>
                    <th className="col-date">📅 Created</th>
                    <th className="col-actions">🎮 Actions</th>
                  </tr>
                </thead>
                
                {/* Table Body */}
                <tbody>
                  {recordings.map((recording) => (
                    <tr key={recording.id} className="table-row">
                      <td className="col-recording">
                        <div className="recording-info">
                          <div className="recording-icon">🎥</div>
                          <div className="recording-details">
                            <div className="recording-name">
                              {getFileName(recording.filename)}
                            </div>
                            <div className="recording-filename">
                              {recording.filename}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="col-status">
                        <Badge className="status-badge status-uploaded">
                          ✅ Uploaded
                        </Badge>
                      </td>
                      
                      <td className="col-size">
                        <Badge className="size-badge">
                          {formatFileSize(recording.size)}
                        </Badge>
                      </td>
                      
                      <td className="col-date">
                        <div className="date-info">
                          {formatDate(recording.created_at)}
                        </div>
                      </td>
                      
                      <td className="col-actions">
                        <div className="action-buttons">
                          <Button
                            className="btn-custom btn-action btn-play"
                            onClick={() => playRecording(recording)}
                            title="Play recording"
                          >
                            <span className="btn-icon">▶️</span>
                          </Button>
                          <Button
                            className="btn-custom btn-action btn-download"
                            onClick={() => downloadRecording(recording)}
                            title="Download recording"
                          >
                            <span className="btn-icon">📥</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                
                {/* Table Footer */}
                {recordings.length > 0 && (
                  <tfoot className="table-footer">
                    <tr>
                      <td colSpan={4} className="footer-label">
                        Total Storage Used
                      </td>
                      <td className="footer-value">
                        {formatFileSize(totalSize)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Consistent Video Player Modal */}
      <Modal 
        show={showModal} 
        onHide={closeModal} 
        size="xl" 
        centered
        className="video-modal-custom"
      >
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title className="modal-title-custom">
            <span className="modal-icon">🎬</span>
            {selectedRecording ? getFileName(selectedRecording.filename) : 'Recording'}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="modal-body-custom">
          {selectedRecording && (
            <div className="video-container">
              <video
                src={`${apiUrl}/api/recordings/${selectedRecording.id}`}
                controls
                autoPlay
                className="video-player"
                onError={(e) => {
                  console.error('Video playback error:', e);
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </Modal.Body>
        
        <Modal.Footer className="modal-footer-custom">
          <div className="modal-footer-content">
            <div className="modal-info">
              {selectedRecording && (
                <>
                  <Badge className="info-badge">ID: {selectedRecording.id}</Badge>
                  <span className="info-text">
                    {formatFileSize(selectedRecording.size)} • {formatDate(selectedRecording.created_at)}
                  </span>
                </>
              )}
            </div>
            <div className="modal-actions">
              <Button 
                className="btn-custom btn-download"
                onClick={() => selectedRecording && downloadRecording(selectedRecording)}
              >
                <span className="btn-icon">📥</span>
                Download
              </Button>
              <Button 
                className="btn-custom btn-secondary"
                onClick={closeModal}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default RecordingsList;