/**
 * Export Recommendations Component
 * 
 * Provides a user interface for exporting recommendations in various formats
 * with format selection, progress indicators, and download functionality.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileCode, 
  Printer,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  X
} from 'lucide-react';
import { PrioritizedRecommendation } from '@/lib/recommendation-prioritization';
import { RecommendationSet } from '@/lib/recommendation-engine';

// Import types from the correct file
type ExportFormat = 'html' | 'pdf' | 'csv' | 'json' | 'text';

interface ClientExportConfig {
  format?: ExportFormat;
  includeMetrics?: boolean;
  includeTimeline?: boolean;
  includeSummary?: boolean;
  includeActionSteps?: boolean;
  groupByPriority?: boolean;
  groupByCategory?: boolean;
  fileName?: string;
  title?: string;
  autoDownload?: boolean;
  openInNewTab?: boolean;
}

// Props interface
interface ExportRecommendationsProps {
  recommendations: PrioritizedRecommendation[];
  context?: {
    sessionId?: string;
    overallAssessment?: RecommendationSet['overallAssessment'];
  };
  className?: string;
  variant?: 'button' | 'card' | 'dropdown';
  showFormatDetails?: boolean;
}

// Export status types
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

// Format icons mapping
const FORMAT_ICONS = {
  html: FileText,
  pdf: Printer,
  csv: FileSpreadsheet,
  json: FileCode,
  text: FileText
} as const;

// Simple modal component
const SimpleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Quick export handlers - simplified versions
const quickExportHandlers = {
  exportAsHTML: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: 'html',
          config: { title: 'Pitch Perfect Recommendations Report' },
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      if (data.success) {
        // Create download
        const blob = new Blob([data.content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.metadata.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  },

  exportAsPDF: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    return quickExportHandlers.exportAsHTML(recommendations, context); // Simplified for now
  },

  exportAsCSV: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: 'csv',
          config: {},
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      if (data.success) {
        // Create download
        const blob = new Blob([data.content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.metadata.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  },

  exportAsJSON: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: 'json',
          config: {},
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      if (data.success) {
        // Create download
        const blob = new Blob([data.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.metadata.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  },

  exportAsText: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: 'text',
          config: {},
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      if (data.success) {
        // Create download
        const blob = new Blob([data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.metadata.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  },

  previewHTML: async (recommendations: PrioritizedRecommendation[], context?: any) => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: 'html',
          config: { title: 'Pitch Perfect Recommendations Report' },
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      if (data.success) {
        // Open in new tab
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(data.content);
          newWindow.document.close();
        }
      }
      
      return data;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  }
};

// Quick export buttons component
const QuickExportButtons: React.FC<{
  recommendations: PrioritizedRecommendation[];
  context?: any;
  disabled?: boolean;
}> = ({ recommendations, context, disabled }) => {
  const [exportStatuses, setExportStatuses] = useState<Record<ExportFormat, ExportStatus>>({
    html: 'idle',
    pdf: 'idle',
    csv: 'idle',
    json: 'idle',
    text: 'idle'
  });

  const handleQuickExport = async (format: ExportFormat, handler: Function) => {
    setExportStatuses(prev => ({ ...prev, [format]: 'exporting' }));
    
    try {
      const result = await handler(recommendations, context);
      setExportStatuses(prev => ({ 
        ...prev, 
        [format]: result.success ? 'success' : 'error' 
      }));
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setExportStatuses(prev => ({ ...prev, [format]: 'idle' }));
      }, 2000);
    } catch (error) {
      setExportStatuses(prev => ({ ...prev, [format]: 'error' }));
      setTimeout(() => {
        setExportStatuses(prev => ({ ...prev, [format]: 'idle' }));
      }, 2000);
    }
  };

  const getButtonIcon = (format: ExportFormat) => {
    const status = exportStatuses[format];
    const IconComponent = FORMAT_ICONS[format];
    
    if (status === 'exporting') return <Loader2 className="h-4 w-4 animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />;
    return <IconComponent className="h-4 w-4" />;
  };

  const quickExports = [
    { format: 'html' as ExportFormat, label: 'HTML', handler: quickExportHandlers.exportAsHTML },
    { format: 'pdf' as ExportFormat, label: 'PDF', handler: quickExportHandlers.exportAsPDF },
    { format: 'csv' as ExportFormat, label: 'CSV', handler: quickExportHandlers.exportAsCSV },
    { format: 'json' as ExportFormat, label: 'JSON', handler: quickExportHandlers.exportAsJSON },
    { format: 'text' as ExportFormat, label: 'Text', handler: quickExportHandlers.exportAsText }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {quickExports.map(({ format, label, handler }) => (
        <Button
          key={format}
          variant="outline"
          size="sm"
          disabled={disabled || exportStatuses[format] === 'exporting'}
          onClick={() => handleQuickExport(format, handler)}
          className="flex items-center gap-2"
        >
          {getButtonIcon(format)}
          {label}
        </Button>
      ))}
    </div>
  );
};

// Advanced export dialog component
const AdvancedExportDialog: React.FC<{
  recommendations: PrioritizedRecommendation[];
  context?: any;
  disabled?: boolean;
}> = ({ recommendations, context, disabled }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html');
  const [config, setConfig] = useState<ClientExportConfig>({
    includeMetrics: true,
    includeSummary: true,
    includeActionSteps: true,
    groupByPriority: true,
    groupByCategory: false,
    autoDownload: true,
    openInNewTab: false
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdvancedExport = async () => {
    setExportStatus('exporting');
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          format: selectedFormat,
          config,
          context
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      setExportStatus(data.success ? 'success' : 'error');
      
      if (data.success && config.autoDownload) {
        // Create download
        const mimeTypes = {
          html: 'text/html',
          pdf: 'application/pdf',
          csv: 'text/csv',
          json: 'application/json',
          text: 'text/plain'
        };
        
        const blob = new Blob([data.content], { type: mimeTypes[selectedFormat] });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.metadata.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setTimeout(() => {
          setIsOpen(false);
          setExportStatus('idle');
        }, 1500);
      }
    } catch (error) {
      setExportStatus('error');
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        disabled={disabled} 
        className="flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Settings className="h-4 w-4" />
        Advanced Export
      </Button>
      
      <SimpleModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Export Recommendations"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Customize your export with advanced options and format selection.
          </p>
          
          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Export Format</label>
            <select 
              value={selectedFormat} 
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="html">HTML - Rich web format</option>
              <option value="pdf">PDF - Portable document</option>
              <option value="csv">CSV - Spreadsheet format</option>
              <option value="json">JSON - Structured data</option>
              <option value="text">Text - Plain text format</option>
            </select>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Include Options</label>
            
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.includeMetrics}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeMetrics: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Include metrics and scores</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.includeSummary}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeSummary: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Include executive summary</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.includeActionSteps}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeActionSteps: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Include action steps</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.groupByPriority}
                  onChange={(e) => setConfig(prev => ({ ...prev, groupByPriority: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Group by priority level</span>
              </label>

              {selectedFormat === 'html' && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.openInNewTab}
                    onChange={(e) => setConfig(prev => ({ ...prev, openInNewTab: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Open in new tab (preview)</span>
                </label>
              )}
            </div>
          </div>

          {/* Export Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Export Summary</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Recommendations:</span>
                <span>{recommendations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Critical Issues:</span>
                <span>{recommendations.filter(r => r.priority === 'critical').length}</span>
              </div>
              <div className="flex justify-between">
                <span>High Priority:</span>
                <span>{recommendations.filter(r => r.priority === 'high').length}</span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleAdvancedExport}
            disabled={exportStatus === 'exporting'}
            className="w-full"
          >
            {exportStatus === 'exporting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : exportStatus === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Export Complete!
              </>
            ) : exportStatus === 'error' ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Export Failed
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
};

// Validation function
function validateRecommendationsForExport(recommendations: PrioritizedRecommendation[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!recommendations || !Array.isArray(recommendations)) {
    errors.push('Recommendations must be an array');
    return { isValid: false, errors };
  }
  
  if (recommendations.length === 0) {
    errors.push('At least one recommendation is required for export');
  }
  
  if (recommendations.length > 100) {
    errors.push('Too many recommendations (max 100)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Main export component
export default function ExportRecommendations({
  recommendations,
  context,
  className = '',
  variant = 'card',
  showFormatDetails = true
}: ExportRecommendationsProps) {
  // Validate recommendations
  const validation = validateRecommendationsForExport(recommendations);
  
  if (!validation.isValid) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Export Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            <p>Cannot export recommendations due to the following issues:</p>
            <ul className="list-disc list-inside mt-2">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Button variant
  if (variant === 'button') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          onClick={() => quickExportHandlers.exportAsHTML(recommendations, context)}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download Report
        </Button>
        <AdvancedExportDialog
          recommendations={recommendations}
          context={context}
          disabled={!validation.isValid}
        />
      </div>
    );
  }

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={className}>
        <QuickExportButtons
          recommendations={recommendations}
          context={context}
          disabled={!validation.isValid}
        />
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Recommendations
        </CardTitle>
        {showFormatDetails && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Badge variant="outline">{recommendations.length} recommendations</Badge>
            <Badge variant="outline">
              {recommendations.filter(r => r.priority === 'critical').length} critical
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Quick Export</h4>
          <QuickExportButtons
            recommendations={recommendations}
            context={context}
            disabled={!validation.isValid}
          />
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <Button
              onClick={() => quickExportHandlers.previewHTML(recommendations, context)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </Button>
          </div>
          <AdvancedExportDialog
            recommendations={recommendations}
            context={context}
            disabled={!validation.isValid}
          />
        </div>
      </CardContent>
    </Card>
  );
} 