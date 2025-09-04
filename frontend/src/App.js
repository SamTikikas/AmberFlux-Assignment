import React, { useState, useRef, useEffect } from 'react';
import { Button, Container, Row, Col, Card, Alert, Badge, ProgressBar } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from 'axios';
import RecordingsList from './RecordingsList';
import './App.css';

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
      // Reset previous recording data
      setRecordedChunks([]);
      setRecordingUrl(null);
      setRecordingTime(0);
      setUploadStatus('');
      setError('');

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen recording is not supported in this browser. Please use Chrome or Edge.');
      }

      // Get display media (screen + audio)
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

      // Try to get microphone audio and combine with screen audio
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        
        // Combine display and microphone streams
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
        // Continue with display stream only
      }

      setStream(combinedStream);

      // Check MediaRecorder support
      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        if (!MediaRecorder.isTypeSupported('video/webm')) {
          throw new Error('WebM recording is not supported in this browser.');
        }
      }

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';
        
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps
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
        
        // Stop all tracks
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

      // Handle stream ending (user stops sharing)
      displayStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing ended by user');
        if (isRecording) {
          stopRecording();
        }
      };

      // Start recording
      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Show live preview
      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
      }

      console.log('Recording started successfully');

    } catch (error) {
      console.error('Error starting recording:', error);
      setError(`Failed to start recording: ${error.message}`);
      
      // Cleanup on error
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
    
    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Reset preview
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
        timeout: 30000, // 30 second timeout
      });

      console.log('Upload successful:', response.data);
      setUploadStatus('success');
      setRefreshKey(prevKey => prevKey + 1);
      
      // Clear the recording after successful upload
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
    <Container className="my-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={8}>
          <Card className="shadow-lg">
            <Card.Header className="bg-primary text-white text-center py-3">
              <h1 className="mb-0">
                🎥 Screen Recorder
                <Badge bg="light" text="primary" className="ms-2">MERN Stack</Badge>
              </h1>
            </Card.Header>
            
            <Card.Body className="p-4">
              {/* Error Display */}
              {error && (
                <Alert variant="danger" dismissible onClose={() => setError('')}>
                  <Alert.Heading>Error</Alert.Heading>
                  {error}
                </Alert>
              )}

              {/* Recording Timer */}
              {isRecording && (
                <div className="recording-status mb-4">
                  <div className="text-center mb-3">
                    <h3 className="text-danger mb-2">
                      🔴 Recording: {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                    </h3>
                    <p className="text-muted mb-2">
                      Time remaining: {formatTime(timeRemaining)}
                    </p>
                  </div>
                  <ProgressBar 
                    variant={progressPercentage > 80 ? 'danger' : 'primary'}
                    now={progressPercentage} 
                    className="mb-3"
                    style={{ height: '8px' }}
                  />
                </div>
              )}

              {/* Live Preview */}
              {isRecording && (
                <div className="mb-4">
                  <h5 className="text-center mb-3">📺 Live Preview</h5>
                  <div className="video-container">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="preview-video"
                    />
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="text-center mb-4">
                <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                  {!isRecording && !recordingUrl && (
                    <Button
                      variant="success"
                      size="lg"
                      onClick={startRecording}
                      className="px-4"
                    >
                      🎬 Start Screen Recording
                    </Button>
                  )}
                  
                  {isRecording && (
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={stopRecording}
                      className="px-4"
                    >
                      ⏹️ Stop Recording
                    </Button>
                  )}
                </div>
              </div>

              {/* Instructions */}
              {!isRecording && !recordingUrl && (
                <Alert variant="info">
                  <h5>📋 Instructions:</h5>
                  <ol className="mb-0">
                    <li>Click "Start Screen Recording" button</li>
                    <li>Select the browser tab or entire screen to record</li>
                    <li>Allow microphone access for better audio quality</li>
                    <li>Recording will automatically stop after 3 minutes</li>
                    <li>You can manually stop anytime by clicking "Stop Recording"</li>
                  </ol>
                </Alert>
              )}

              {/* Recording Preview & Actions */}
              {recordingUrl && !isRecording && (
                <div className="recording-result">
                  <h5 className="text-center mb-3">✅ Recording Complete!</h5>
                  
                  <div className="video-container mb-3">
                    <video
                      src={recordingUrl}
                      controls
                      className="result-video"
                    />
                  </div>
                  
                  <div className="text-center">
                    <div className="d-grid gap-2 d-md-flex justify-content-md-center mb-3">
                      <Button 
                        variant="info" 
                        onClick={downloadRecording}
                        className="px-4"
                      >
                        📥 Download Recording
                      </Button>
                      
                      <Button
                        variant="primary"
                        onClick={handleUpload}
                        disabled={uploadStatus === 'uploading'}
                        className="px-4"
                      >
                        {uploadStatus === 'uploading' ? (
                          <>⏳ Uploading...</>
                        ) : (
                          <>☁️ Upload to Server</>
                        )}
                      </Button>
                      
                      <Button 
                        variant="outline-secondary" 
                        onClick={clearRecording}
                        className="px-4"
                      >
                        🗑️ Clear
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline-success" 
                      onClick={() => {
                        clearRecording();
                        // Small delay to ensure state is reset
                        setTimeout(() => {
                          startRecording();
                        }, 100);
                      }}
                      className="px-4"
                    >
                      🔄 Record Another
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload Status */}
              {uploadStatus === 'success' && (
                <Alert variant="success" className="mt-3">
                  <Alert.Heading>✅ Success!</Alert.Heading>
                  Recording uploaded successfully! Check the recordings list below.
                </Alert>
              )}
              
              {uploadStatus === 'error' && (
                <Alert variant="danger" className="mt-3">
                  <Alert.Heading>❌ Upload Failed</Alert.Heading>
                  Failed to upload recording. Please check your connection and try again.
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Recordings List */}
          <RecordingsList refreshKey={refreshKey} apiUrl={API_URL} />
        </Col>
      </Row>
    </Container>
  );
};

export default App;