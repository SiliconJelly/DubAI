import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Zap, Shield, Smartphone, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnhancedUploadContainer } from '@/components/ui/enhanced/enhanced-upload-container';

export const UploadDemo: React.FC = () => {
  const navigate = useNavigate();
  const [jobCreated, setJobCreated] = useState<string | null>(null);

  const handleUploadComplete = (fileIds: string[]) => {
    console.log('Files uploaded successfully:', fileIds);
  };

  const handleCreateJob = (videoFileId?: string, srtFileId?: string) => {
    console.log('Creating job with files:', { videoFileId, srtFileId });
    
    // Simulate job creation
    const jobId = `job-${Date.now()}`;
    setJobCreated(jobId);
    
    // In a real app, you would navigate to the job processing page
    setTimeout(() => {
      navigate(`/dashboard/jobs/${jobId}`);
    }, 3000);
  };

  return (
    <div className="min-h-screen">
      {/* Enhanced Upload Container */}
      <EnhancedUploadContainer
        onUploadComplete={handleUploadComplete}
        onCreateJob={handleCreateJob}
        title="DubAI File Upload Experience"
        description="Experience the future of file uploads with our Aceternity-inspired interface"
        showCreateJobButton={true}
      />

      {/* Job Creation Success */}
      {jobCreated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-white/90 border border-white/30 shadow-2xl p-8 max-w-md mx-4"
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            <div className="relative z-10 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-flex items-center justify-center p-4 rounded-2xl bg-green-500/20 backdrop-blur-sm mb-6"
              >
                <Sparkles className="w-8 h-8 text-green-600" />
              </motion.div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Job Created Successfully! 🎉
              </h3>
              
              <p className="text-gray-600 mb-4">
                Your dubbing job has been created with ID:
              </p>
              
              <code className="inline-block bg-gray-100 px-4 py-2 rounded-xl font-mono text-sm text-gray-800 mb-6">
                {jobCreated}
              </code>
              
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm text-gray-500"
              >
                Redirecting to job dashboard...
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-6 left-6 z-40"
      >
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="backdrop-blur-xl bg-white/20 border border-white/30 hover:bg-white/30"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </motion.div>

      {/* Feature Showcase */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-6">
            Enhanced Features
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Built with modern design principles and cutting-edge technology
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: 'Glassmorphism Design',
              description: 'Beautiful frosted glass effects with backdrop blur and transparency layers.',
              gradient: 'from-blue-500 to-cyan-500',
              delay: 0.7
            },
            {
              icon: Zap,
              title: 'Framer Motion Animations',
              description: 'Smooth, performant animations that guide user attention and provide feedback.',
              gradient: 'from-purple-500 to-pink-500',
              delay: 0.8
            },
            {
              icon: Shield,
              title: 'Advanced Validation',
              description: 'Comprehensive file validation with real-time feedback and error handling.',
              gradient: 'from-green-500 to-emerald-500',
              delay: 0.9
            },
            {
              icon: Eye,
              title: 'Interactive Previews',
              description: 'Rich file previews with video player controls and subtitle content viewing.',
              gradient: 'from-orange-500 to-red-500',
              delay: 1.0
            },
            {
              icon: Smartphone,
              title: 'Mobile Optimized',
              description: 'Touch-friendly interface that works perfectly on all device sizes.',
              gradient: 'from-indigo-500 to-purple-500',
              delay: 1.1
            },
            {
              icon: Settings,
              title: 'TypeScript Ready',
              description: 'Fully typed components with comprehensive interfaces and validation.',
              gradient: 'from-teal-500 to-blue-500',
              delay: 1.2
            }
          ].map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: feature.delay }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/20 border border-white/30 shadow-lg p-6"
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-5`}
                whileHover={{ opacity: 0.1 }}
              />
              
              <div className="relative z-10">
                <motion.div
                  className={`inline-flex items-center justify-center p-3 rounded-xl mb-4 bg-gradient-to-r ${feature.gradient} bg-opacity-20`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </motion.div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};