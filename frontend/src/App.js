import React, { useState, useRef, useEffect } from 'react';
import { Button, Container, Row, Col, Card, Alert, Badge, ProgressBar, Nav, Navbar } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import RecordingsList from './RecordingsList';
import './App.css';
import './design.css';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const App = () => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState(null);
  
  // UI state
  const [uploadStatus, setUploadStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState('recorder');
  
  // Refs
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  
  const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

  // Timer effect
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
          const newTime = prevTime + 1;
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      setRecordingUrl(null);
      setRecordingTime(0);
      setUploadStatus('');
      setError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen recording is not supported in this browser. Please use Chrome or Edge.');
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          mediaSource: 'screen',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      let combinedStream = displayStream;

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        
        const audioTracks = [
          ...displayStream.getAudioTracks(),
          ...micStream.getAudioTracks()
        ];
        
        combinedStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...audioTracks
        ]);
      } catch (micError) {
        console.warn('Microphone access denied, using only screen audio:', micError);
      }

      setStream(combinedStream);

      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        if (!MediaRecorder.isTypeSupported('video/webm')) {
          throw new Error('WebM recording is not supported in this browser.');
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';
        
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      });

      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped, creating blob...');
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setRecordedChunks([blob]);
        
        combinedStream.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
        setStream(null);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message}`);
        stopRecording();
      };

      displayStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing ended by user');
        if (isRecording) {
          stopRecording();
        }
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);

      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }

      console.log('Recording started successfully');

    } catch (error) {
      console.error('Error starting recording:', error);
      setError(`Failed to start recording: ${error.message}`);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording...');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    setIsRecording(false);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleUpload = async () => {
    if (recordedChunks.length === 0) {
      alert('No recording available to upload.');
      return;
    }

    setUploadStatus('uploading');

    try {
      const formData = new FormData();
      const filename = `recording-${Date.now()}.webm`;
      formData.append('video', recordedChunks[0], filename);

      const response = await axios.post(`${API_URL}/api/recordings`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('Upload successful:', response.data);
      setUploadStatus('success');
      setRefreshKey(prevKey => prevKey + 1);
      
      setTimeout(() => {
        setUploadStatus('');
      }, 3000);
      
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus('error');
      
      setTimeout(() => {
        setUploadStatus('');
      }, 5000);
    }
  };

  const downloadRecording = () => {
    if (recordingUrl) {
      const a = document.createElement('a');
      a.href = recordingUrl;
      a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const clearRecording = () => {
    setRecordingUrl(null);
    setRecordedChunks([]);
    setUploadStatus('');
    setError('');
    setRecordingTime(0);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const progressPercentage = (recordingTime / MAX_RECORDING_TIME) * 100;
  const timeRemaining = MAX_RECORDING_TIME - recordingTime;

  return (
    <div className="app-wrapper">
      {/* Consistent Navigation Header */}
      <Navbar bg="primary" variant="dark" expand="lg" className="navbar-custom">
        <Container>
          <Navbar.Brand className="brand-logo">
            <span className="brand-icon">🎥</span>
            Screen Recorder
          </Navbar.Brand>
          <Nav className="ms-auto">
            <Nav.Link 
              className={`nav-link-custom ${currentView === 'recorder' ? 'active' : ''}`}
              onClick={() => setCurrentView('recorder')}
            >
              📹 Recorder
            </Nav.Link>
            <Nav.Link 
              className={`nav-link-custom ${currentView === 'recordings' ? 'active' : ''}`}
              onClick={() => setCurrentView('recordings')}
            >
              📁 My Recordings
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Container className="main-content">
        <Row className="justify-content-center">
          <Col lg={10} xl={8}>
            
            {/* Recorder View */}
            {currentView === 'recorder' && (
              <div className="view-container">
                {/* Page Header */}
                <div className="page-header">
                  <h1 className="page-title">
                    🎬 Screen Recorder
                    <Badge className="status-badge ms-3">
                      {isRecording ? '🔴 Recording' : recordingUrl ? '✅ Complete' : '⭕ Ready'}
                    </Badge>
                  </h1>
                  <p className="page-subtitle">
                    Record your browser screen with professional quality audio and video
                  </p>
                </div>

                {/* Main Recording Card */}
                <Card className="main-card">
                  <Card.Body className="card-body-custom">
                    
                    {/* Error Display */}
                    {error && (
                      <Alert variant="danger" className="alert-custom" dismissible onClose={() => setError('')}>
                        <div className="alert-content">
                          <span className="alert-icon">⚠️</span>
                          <div>
                            <strong>Recording Error</strong>
                            <p className="mb-0">{error}</p>
                          </div>
                        </div>
                      </Alert>
                    )}

                    {/* Recording Timer */}
                    {isRecording && (
                      <div className="recording-timer">
                        <div className="timer-display">
                          <span className="recording-indicator">🔴</span>
                          <span className="timer-text">
                            {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                          </span>
                        </div>
                        <ProgressBar 
                          variant={progressPercentage > 80 ? 'danger' : 'primary'}
                          now={progressPercentage} 
                          className="progress-custom"
                        />
                        <div className="timer-info">
                          Time remaining: {formatTime(timeRemaining)}
                        </div>
                      </div>
                    )}

                    {/* Live Preview */}
                    {isRecording && (
                      <div className="video-section">
                        <div className="section-header">
                          <h5>📺 Live Preview</h5>
                          <Badge className="live-badge">LIVE</Badge>
                        </div>
                        <div className="video-container">
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="video-player"
                          />
                        </div>
                      </div>
                    )}

                    {/* Control Buttons */}
                    <div className="controls-section">
                      {!isRecording && !recordingUrl && (
                        <Button
                          className="btn-custom btn-start"
                          size="lg"
                          onClick={startRecording}
                        >
                          <span className="btn-icon">🎬</span>
                          Start Screen Recording
                        </Button>
                      )}
                      
                      {isRecording && (
                        <Button
                          className="btn-custom btn-stop"
                          size="lg"
                          onClick={stopRecording}
                        >
                          <span className="btn-icon">⏹️</span>
                          Stop Recording
                        </Button>
                      )}
                    </div>

                    {/* Instructions */}
                    {!isRecording && !recordingUrl && (
                      <div className="instructions-section">
                        <div className="instruction-header">
                          <span className="instruction-icon">📋</span>
                          <h5>How to Record</h5>
                        </div>
                        <ol className="instruction-list">
                          <li>Click "Start Screen Recording" button</li>
                          <li>Select the browser tab or entire screen</li>
                          <li>Allow microphone access for audio</li>
                          <li>Recording stops automatically after 3 minutes</li>
                          <li>Download or upload your recording</li>
                        </ol>
                      </div>
                    )}

                    {/* Recording Result */}
                    {recordingUrl && !isRecording && (
                      <div className="result-section">
                        <div className="section-header">
                          <h5>✅ Recording Complete</h5>
                          <Badge className="success-badge">Ready</Badge>
                        </div>
                        
                        <div className="video-section">
                          <div className="video-container">
                            <video
                              src={recordingUrl}
                              controls
                              className="video-player"
                            />
                          </div>
                        </div>
                        
                        <div className="actions-section">
                          <div className="action-group primary-actions">
                            <Button 
                              className="btn-custom btn-download"
                              onClick={downloadRecording}
                            >
                              <span className="btn-icon">📥</span>
                              Download
                            </Button>
                            
                            <Button
                              className="btn-custom btn-upload"
                              onClick={handleUpload}
                              disabled={uploadStatus === 'uploading'}
                            >
                              <span className="btn-icon">
                                {uploadStatus === 'uploading' ? '⏳' : '☁️'}
                              </span>
                              {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
                            </Button>
                          </div>
                          
                          <div className="action-group secondary-actions">
                            <Button 
                              className="btn-custom btn-secondary"
                              onClick={clearRecording}
                            >
                              <span className="btn-icon">🗑️</span>
                              Clear
                            </Button>
                            
                            <Button 
                              className="btn-custom btn-secondary"
                              onClick={() => {
                                clearRecording();
                                setTimeout(() => startRecording(), 100);
                              }}
                            >
                              <span className="btn-icon">🔄</span>
                              Record Again
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upload Status */}
                    {uploadStatus === 'success' && (
                      <Alert className="alert-custom alert-success">
                        <div className="alert-content">
                          <span className="alert-icon">✅</span>
                          <div>
                            <strong>Upload Successful!</strong>
                            <p className="mb-0">Recording saved successfully. Check your recordings list.</p>
                          </div>
                        </div>
                      </Alert>
                    )}
                    
                    {uploadStatus === 'error' && (
                      <Alert className="alert-custom alert-error">
                        <div className="alert-content">
                          <span className="alert-icon">❌</span>
                          <div>
                            <strong>Upload Failed</strong>
                            <p className="mb-0">Failed to upload recording. Please try again.</p>
                          </div>
                        </div>
                      </Alert>
                    )}
                  </Card.Body>
                </Card>
              </div>
            )}

            {/* Recordings View */}
            {currentView === 'recordings' && (
              <div className="view-container">
                <div className="page-header">
                  <h1 className="page-title">
                    📁 My Recordings
                    <Badge className="count-badge ms-3">Dashboard</Badge>
                  </h1>
                  <p className="page-subtitle">
                    Manage and view all your screen recordings
                  </p>
                </div>
                
                <RecordingsList refreshKey={refreshKey} apiUrl={API_URL} />
              </div>
            )}

            {/* Show recent recordings in recorder view */}
            {currentView === 'recorder' && (
              <div className="recent-section">
                <div className="section-header">
                  <h4 className='recent-heading'>📂 Recent Recordings</h4>
                  <Button 
                    className="btn-custom btn-link"
                    onClick={() => setCurrentView('recordings')}
                  >
                    View All →
                  </Button>
                </div>
                <RecordingsList refreshKey={refreshKey} apiUrl={API_URL} />
              </div>
            )}

          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default App;