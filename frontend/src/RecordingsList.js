import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Alert, Button, Modal } from 'react-bootstrap';

const RecordingsList = ({ apiUrl }) => {
  const [recordings, setRecordings] = useState([]);
  const [error, setError] = useState(null);
  const [totalSize, setTotalSize] = useState(0);
  
  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    axios.get(`${apiUrl}/api/recordings`)
      .then((res) => {
        setRecordings(res.data);
        setTotalSize(res.data.reduce((acc, r) => acc + r.size, 0));
      })
      .catch(() => setError('Failed to load recordings. Please try again.'));
  }, [apiUrl]);

  const formatSize = (size) => {
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleString();

  const handlePreview = (recording) => {
    setPreviewUrl(`${apiUrl}/api/recordings/${recording.id}`);
    setPreviewTitle(recording.filename);
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    setPreviewUrl('');
    setPreviewTitle('');
  };

  if (error) return <Alert variant="danger">{error}</Alert>;

  if (!recordings.length)
    return <p>Start by recording your screen above, then upload it to see it here.</p>;

  return (
    <>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>🎬 Recording</th>
            <th>📏 Size</th>
            <th>📅 Created</th>
            <th>🎮 Actions</th>
          </tr>
        </thead>
        <tbody>
          {recordings.map((recording) => (
            <tr key={recording.id}>
              <td>{recording.filename}</td>
              <td>{formatSize(recording.size)}</td>
              <td>{formatDate(recording.created_at)}</td>
              <td>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePreview(recording)}
                  className="me-2"
                >
                  ▶️ Preview
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      
      <p><strong>Total Storage Used:</strong> {formatSize(totalSize)}</p>

      {/* Preview Modal */}
      <Modal show={showPreview} onHide={handleClosePreview} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>📹 {previewTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewUrl && (
            <video
              src={previewUrl}
              controls
              autoPlay
              style={{ 
                width: '100%', 
                maxHeight: '70vh',
                borderRadius: '8px' 
              }}
              onError={(e) => {
                console.error('Video load error:', e);
                setError('Failed to load video preview');
              }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClosePreview}>
            Close Preview
          </Button>
          <Button 
            variant="primary"
            onClick={() => window.open(previewUrl, '_blank')}
          >
            🔗 Open in New Tab
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default RecordingsList;