import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Container,
  Card,
  Alert,
  ProgressBar,
  Nav,
  Navbar,
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import RecordingsList from './RecordingsList';
import './App.css';
import './design.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState(null);

  const [uploadStatus, setUploadStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState('recorder');

  const videoRef = useRef(null);
  const timerRef = useRef(null);

  const MAX_RECORDING_TIME = 180; // seconds

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      setRecordingUrl(null);
      setRecordingTime(0);
      setUploadStatus('');
      setError('');

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
      ) {
        throw new Error(
          'Screen recording not supported. Use Chrome or Edge.'
        );
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      });

      let combinedStream = displayStream;

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        combinedStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...displayStream.getAudioTracks(),
          ...micStream.getAudioTracks(),
        ]);
      } catch (micError) {
        console.warn('Mic access denied, continuing with screen audio only');
      }

      setStream(combinedStream);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('WebM recording not supported.');
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setRecordedChunks([blob]);
        combinedStream.getTracks().forEach((t) => t.stop());
        setStream(null);
      };

      recorder.onerror = (e) => {
        setError(`Recording error: ${e.error.message}`);
        stopRecording();
      };

      displayStream.getVideoTracks()[0].onended = () => {
        console.log('User stopped screen sharing');
        if (isRecording) stopRecording();
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);

      if (videoRef.current) videoRef.current.srcObject = displayStream;
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleUpload = async () => {
    if (recordedChunks.length === 0) return alert('No recording to upload');
    setUploadStatus('uploading');
    try {
      const formData = new FormData();
      formData.append(
        'video',
        recordedChunks[0],
        `recording-${Date.now()}.webm`
      );

      await axios.post(`${API_URL}/api/recordings`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      setUploadStatus('success');
      setRefreshKey((k) => k + 1);
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (err) {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus(''), 5000);
    }
  };

  const downloadRecording = () => {
    if (!recordingUrl) return;
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `recording-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clearRecording = () => {
    setRecordingUrl(null);
    setRecordedChunks([]);
    setUploadStatus('');
    setError('');
    setRecordingTime(0);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const progressPercent = (recordingTime / MAX_RECORDING_TIME) * 100;

  return (
    <>
      <Navbar bg="primary" variant="dark" className="navbar-custom">
        <Container>
          <Navbar.Brand href="#" className="brand-logo">
            <i className="bi bi-camera-reels brand-icon" />
            Screen Recorder
          </Navbar.Brand>
          <Nav>
            <Nav.Link
              className={`nav-link-custom ${
                currentView === 'recorder' ? 'active' : ''
              }`}
              onClick={() => setCurrentView('recorder')}
            >
              Recorder
            </Nav.Link>
            <Nav.Link
              className={`nav-link-custom ${
                currentView === 'list' ? 'active' : ''
              }`}
              onClick={() => setCurrentView('list')}
            >
              Recordings
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Container className="main-content">
        {error && <Alert variant="danger">{error}</Alert>}

        {currentView === 'recorder' && (
          <Card className="main-card mb-4">
            <Card.Header className="card-header-custom">
              <h2 className="card-title">Record Your Screen</h2>
            </Card.Header>
            <Card.Body className="card-body-custom">
              <div className="d-flex gap-3 align-items-center mb-3">
                <Button
                  variant={isRecording ? 'danger' : 'success'}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
                <ProgressBar
                  now={progressPercent}
                  label={formatTime(recordingTime)}
                  style={{ flex: 1 }}
                />
              </div>

              {recordingUrl && (
                <>
                  <video ref={videoRef} controls src={recordingUrl} width="100%" />
                  <div className="mt-3 d-flex gap-2 flex-wrap">
                    <Button variant="primary" onClick={downloadRecording}>
                      Download
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleUpload}
                      disabled={uploadStatus === 'uploading'}
                    >
                      {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
                    </Button>
                    <Button variant="secondary" onClick={clearRecording}>
                      Clear
                    </Button>
                  </div>
                </>
              )}

              {uploadStatus === 'success' && (
                <Alert variant="success" className="mt-3">
                  Recording uploaded successfully!
                </Alert>
              )}
              {uploadStatus === 'error' && (
                <Alert variant="danger" className="mt-3">
                  Failed to upload recording. Please try again.
                </Alert>
              )}
            </Card.Body>
          </Card>
        )}

        {currentView === 'list' && <RecordingsList key={refreshKey} apiUrl={API_URL} />}
      </Container>
    </>
  );
};

export default App;
