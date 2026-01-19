'use client';

import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <circle cx="12" cy="12" r="6" strokeWidth="2" />
                <circle cx="12" cy="12" r="2" strokeWidth="2" />
              </svg>
              <div>
                <h1 className="text-xl font-bold">BRIGX</h1>
                <p className="text-xs text-blue-100">BLAST Ring Image Generator</p>
              </div>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">About BRIGX</h1>
            
            <div className="prose dark:prose-invert max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-4">Overview</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                BRIGX (BLAST Ring Image Generator eXtended) is a web-based tool for comparative genomics visualization. 
                It creates circular genome comparison plots similar to the original BRIG tool, but runs entirely in your browser 
                using WebAssembly technology.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">Features</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li>Compare multiple genome sequences against a reference genome</li>
                <li>Interactive circular visualization with multiple rings</li>
                <li>GC content and GC skew analysis</li>
                <li>Configurable alignment parameters</li>
                <li>Export results as SVG or PNG</li>
                <li>Download alignment results for each ring</li>
                <li>All processing happens locally in your browser</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">How It Works</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                BRIGX uses LASTZ, a powerful DNA sequence alignment tool, compiled to WebAssembly. This allows 
                sophisticated bioinformatics analysis to run directly in your web browser without requiring any 
                server-side processing or data upload.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                All processing happens locally in your browser using WebAssembly. Your genome data never leaves 
                your computer, ensuring complete privacy and security of your research data.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">Technology Stack</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                <li><strong>LASTZ:</strong> DNA sequence alignment tool (v1.04.52)</li>
                <li><strong>WebAssembly:</strong> High-performance browser execution</li>
                <li><strong>Next.js:</strong> React framework for the user interface</li>
                <li><strong>Web Workers:</strong> Parallel processing for faster alignments</li>
              </ul>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">Citation</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you use BRIGX in your research, please cite the original BRIG paper:
              </p>
              <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 mb-4">
                Alikhan NF, Petty NK, Ben Zakour NL, Beatson SA (2011) BLAST Ring Image Generator (BRIG): 
                simple prokaryote genome comparisons. BMC Genomics 12:402.
              </blockquote>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">Contributing</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                BRIGX is an open-source project. You can edit this page and contribute to the project on GitHub.
              </p>

              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <Link 
                  href="/"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Application
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-600 dark:text-gray-400 text-sm mb-4 md:mb-0">
              © 2026 BRIGX. Built with Next.js and WebAssembly.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                About
              </Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
