import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

async function startServer() {
    console.log('Starting DubAI Full-Stack Server...');
    
    try {
        // Initialize Express app
        const app = express();
        const server = createServer(app);
        const io = new SocketIOServer(server, {
            cors: {
                origin: process.env['CORS_ORIGIN'] || "http://localhost:8080",
                methods: ["GET", "POST"]
            }
        });

        // Middleware
        app.use(cors({
            origin: process.env['CORS_ORIGIN'] || "http://localhost:8080",
            credentials: true
        }));
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Health check endpoint
        app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        transcription: { status: 'up' },
                        tts: { status: 'up' },
                        assembly: { status: 'up' }
                    }
                }
            });
        });

        // Basic API routes placeholder
        app.get('/api/jobs', (req, res) => {
            res.json({ 
                success: true, 
                data: [
                    {
                        id: '1',
                        userId: 'user1',
                        title: 'Sample Job 1',
                        status: 'completed',
                        progress: 100,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        inputFiles: {},
                        outputFiles: {},
                        processingMetrics: {
                            costBreakdown: {
                                transcriptionCost: 0,
                                translationCost: 0,
                                ttsCost: 0,
                                processingCost: 0,
                                totalCost: 0
                            }
                        }
                    }
                ], 
                message: 'Jobs endpoint ready' 
            });
        });

        app.post('/api/jobs', (req, res) => {
            const newJob = {
                id: Date.now().toString(),
                userId: 'user1',
                title: req.body.title || 'New Job',
                status: 'uploaded',
                progress: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                inputFiles: {},
                outputFiles: {},
                processingMetrics: {
                    costBreakdown: {
                        transcriptionCost: 0,
                        translationCost: 0,
                        ttsCost: 0,
                        processingCost: 0,
                        totalCost: 0
                    }
                }
            };

            res.json({ 
                success: true, 
                data: newJob,
                message: 'Job created successfully' 
            });

            // Simulate job progress updates via WebSocket
            setTimeout(() => {
                io.emit('job_update', {
                    jobId: newJob.id,
                    status: 'transcribing',
                    progress: 25,
                    message: 'Starting transcription...'
                });
            }, 1000);

            setTimeout(() => {
                io.emit('job_update', {
                    jobId: newJob.id,
                    status: 'generating_speech',
                    progress: 75,
                    message: 'Generating speech...'
                });
            }, 3000);

            setTimeout(() => {
                io.emit('job_update', {
                    jobId: newJob.id,
                    status: 'completed',
                    progress: 100,
                    message: 'Job completed successfully!'
                });
            }, 5000);
        });

        // WebSocket connection handling
        io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            
            socket.emit('system_message', {
                message: 'Connected to DubAI server'
            });
            
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        // Start server
        const PORT = process.env['PORT'] || 3000;
        server.listen(PORT, () => {
            console.log(`DubAI Backend Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
            console.log('WebSocket server ready for real-time updates');
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\nShutting down gracefully...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('Failed to initialize DubAI Server:', error);
        process.exit(1);
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    startServer().catch(console.error);
}

export { startServer };