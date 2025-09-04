import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Alert, Badge, Spinner, Modal } from 'react-bootstrap';
import axios from 'axios';

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
    // Extract a more readable name from the filename
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

  if (loading) {
    return (
      <Card className="mt-4 shadow">
        <Card.Header className="bg-light">
          <h4 className="mb-0">📂 Uploaded Recordings</h4>
        </Card.Header>
        <Card.Body className="text-center py-5">
          <Spinner animation="border" role="status" className="mb-3">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="text-muted">Loading recordings...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-4 shadow">
        <Card.Header className="bg-light d-flex justify-content-between align-items-center">
          <h4 className="mb-0">📂 Uploaded Recordings</h4>
          <div>
            <Badge bg="primary" className="me-2">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </Badge>
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={fetchRecordings}
              disabled={loading}
            >
              🔄 Refresh
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="warning" dismissible onClose={() => setError(null)}>
              <Alert.Heading>⚠️ Connection Issue</Alert.Heading>
              <p>{error}</p>
              <div className="d-flex gap-2">
                <Button variant="outline-warning" size="sm" onClick={fetchRecordings}>
                  Try Again
                </Button>
              </div>
            </Alert>
          )}
          
          {recordings.length === 0 && !error ? (
            <Alert variant="info" className="text-center mb-0">
              <h5>📹 No recordings yet</h5>
              <p className="mb-0">
                Start by recording your screen above, then upload it to see it in this list!
              </p>
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>🎬 Title</th>
                    <th>📏 Size</th>
                    <th>📅 Created</th>
                    <th>🎮 Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((recording) => (
                    <tr key={recording.id}>
                      <td>
                        <strong className="text-primary">
                          {getFileName(recording.filename)}
                        </strong>
                        <br />
                        <small className="text-muted">{recording.filename}</small>
                      </td>
                      <td>
                        <Badge bg="secondary">
                          {formatFileSize(recording.size)}
                        </Badge>
                      </td>
                      <td className="text-muted">
                        {formatDate(recording.created_at)}
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => playRecording(recording)}
                            title="Play recording"
                          >
                            ▶️ Play
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => downloadRecording(recording)}
                            title="Download recording"
                          >
                            📥 Download
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Video Player Modal */}
      <Modal 
        show={showModal} 
        onHide={closeModal} 
        size="lg" 
        centered
        className="video-modal"
      >
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>
            🎬 {selectedRecording ? getFileName(selectedRecording.filename) : 'Recording'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 bg-dark">
          {selectedRecording && (
            <video
              src={`${apiUrl}/api/recordings/${selectedRecording.id}`}
              controls
              autoPlay
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '70vh'
              }}
              onError={(e) => {
                console.error('Video playback error:', e);
              }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="text-muted small">
              {selectedRecording && (
                <>
                  Size: {formatFileSize(selectedRecording.size)} • 
                  Created: {formatDate(selectedRecording.created_at)}
                </>
              )}
            </div>
            <div>
              <Button 
                variant="outline-success" 
                size="sm" 
                onClick={() => selectedRecording && downloadRecording(selectedRecording)}
                className="me-2"
              >
                📥 Download
              </Button>
              <Button variant="secondary" onClick={closeModal}>
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