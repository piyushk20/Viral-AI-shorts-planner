import React, { useState, useMemo } from 'react';
import { Idea, Duration } from '../types';
import { DURATIONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import ClipboardIcon from './icons/ClipboardIcon';

interface ScriptGeneratorModalProps {
  idea: Idea | null;
  onClose: () => void;
  onGenerate: (sceneDuration: string, noNarration: boolean, suggestion?: string) => void;
  onFinalize: (sceneDuration: string) => void;
  isLoading: boolean;
  script: string | null;
  finalJsonScript: string | null;
}

const ScriptGeneratorModal: React.FC<ScriptGeneratorModalProps> = ({
  idea,
  onClose,
  onGenerate,
  onFinalize,
  isLoading,
  script,
  finalJsonScript
}) => {
  const [duration, setDuration] = useState<Duration>(idea?.duration || Duration.Shorts30);
  const [suggestion, setSuggestion] = useState('');
  const [noNarration, setNoNarration] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<'script' | 'json' | null>(null);
  const [jsonSceneDuration, setJsonSceneDuration] = useState('15');

  const scriptParts = useMemo(() => {
    if (!script) return { suggestions: null, table: null };
    const parts = script.split(/\n---\n/);
    if (parts.length > 1 && parts[0].toLowerCase().includes('suggested narration styles')) {
        return { suggestions: parts[0], table: parts.slice(1).join('\n---\n').trim() };
    }
    return { suggestions: null, table: script };
  }, [script]);

  const { suggestions: narrationSuggestions, table: scriptTable } = scriptParts;

  if (!idea) return null;

  const handleCopy = (textToCopy: string | null, type: 'script' | 'json') => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedStatus(type);
        setTimeout(() => setCopiedStatus(null), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard.');
    });
  };

  const renderNarrationSuggestions = (text: string) => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    const title = lines.shift() || '';

    const formattedLines = lines.map(line => {
        let formattedLine = line
            .replace(/^\d+\.\s*/, '') // remove numbering
            .replace(/\*\*(.*?):\*\*/g, '<strong class="text-slate-800">$1:</strong>')
            .replace(/\*(Best for:.*?)\*/g, '<em class="block text-slate-500 text-xs mt-1">$1</em>');
        return `<li class="text-sm mb-3">${formattedLine}</li>`;
    }).join('');

    return (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 animate-fade-in">
            <h4 className="text-lg font-bold text-amber-800" dangerouslySetInnerHTML={{ __html: title.replace(/\*\*/g, '') }} />
            <ul className="list-decimal list-inside mt-2 text-slate-600" dangerouslySetInnerHTML={{ __html: formattedLines }} />
        </div>
    );
  };

  const renderScriptTable = (markdown: string) => {
    try {
        const lines = markdown.trim().split('\n');
        const headerLine = lines.find(line => line.includes('|') && line.toLowerCase().includes('timestamp'));
        if (!headerLine) return <pre className="whitespace-pre-wrap text-sm text-slate-200 bg-slate-800 p-4 rounded-lg">{markdown}</pre>;

        const headerIndex = lines.indexOf(headerLine);
        const header = headerLine.split('|').map(h => h.trim()).filter(Boolean);
        const dataRows = lines.slice(headerIndex + 2);
        const rows = dataRows.map(line => {
            const cells = line.split('|').map(c => c.trim());
            // Remove first and last empty cells if they exist from table formatting `| cell | cell |`
            if (cells[0] === '' && cells[cells.length - 1] === '') {
                return cells.slice(1, -1);
            }
            return cells;
        }).filter(row => row.length > 1);
    
        return (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left text-slate-600">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                        <tr>
                            {header.map((h, i) => <th key={i} className="px-4 py-3">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50">
                                {row.map((cell, j) => (
                                    <td key={j} className="px-4 py-3 align-top">
                                        {cell.split('\n').map((line, k) => <p key={k}>{line}</p>)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    } catch (e) {
        console.error("Failed to parse script markdown:", e);
        return <pre className="whitespace-pre-wrap text-sm text-slate-200 bg-slate-800 p-4 rounded-lg">{markdown}</pre>;
    }
  };
  
  const renderFinalJson = (jsonString: string) => {
    try {
      const scenes = JSON.parse(jsonString);
      if (Array.isArray(scenes)) {
        return (
          <div className="space-y-2 max-h-[40vh] overflow-y-auto bg-slate-900 p-2 rounded-lg border border-slate-700">
            {scenes.map((scene, index) => (
              <details key={index} className="bg-slate-800 rounded-md" open={index === 0}>
                <summary className="text-md font-semibold text-fuchsia-400 px-4 py-2 rounded-t-md cursor-pointer hover:bg-slate-700">
                  Scene {scene.scene} ({scene.scene_timestamp})
                </summary>
                <pre className="whitespace-pre-wrap text-sm text-slate-200 p-4 pt-2 overflow-x-auto">
                  {JSON.stringify(scene, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Fallback for invalid JSON or non-array structure
    }
    // Fallback view for raw string or malformed JSON
    return (
      <pre className="whitespace-pre-wrap text-sm text-slate-200 bg-slate-800 p-4 rounded-lg overflow-x-auto max-h-[40vh]">
        {jsonString}
      </pre>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-6 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Script Generator</h2>
            <p className="text-sm text-slate-500 truncate">For idea: "{idea.title}"</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none p-2">&times;</button>
        </header>

        <main className="p-6 overflow-y-auto flex-grow space-y-6">
          {!script && !isLoading && (
            <div className="text-center bg-slate-50 p-8 rounded-lg border border-dashed border-slate-300">
              <h3 className="text-xl font-bold text-slate-700 mb-2">Ready to Write a Script?</h3>
              <p className="text-slate-500 mb-4">Select a duration and let the AI screenwriter create a production-ready script for your idea.</p>
              <div className="flex justify-center items-center gap-4">
                <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as Duration)}
                    className="px-4 py-2 text-base text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                >
                    {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={() => onGenerate(duration, noNarration)} className="px-6 py-2 bg-fuchsia-600 text-white font-bold rounded-lg hover:bg-fuchsia-500">
                    Generate Script
                </button>
              </div>
              <div className="flex justify-center items-center gap-2 mt-3">
                <input
                  type="checkbox"
                  id="no-narration-initial"
                  checked={noNarration}
                  onChange={(e) => setNoNarration(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                />
                <label htmlFor="no-narration-initial" className="text-sm text-slate-600">
                  No Narration Required
                </label>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center p-8">
              <LoadingSpinner />
            </div>
          )}
          
          {script && (
            <>
              {narrationSuggestions && renderNarrationSuggestions(narrationSuggestions)}
              
              {scriptTable && (
                 <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-bold text-slate-800">Generated Script</h3>
                        <button
                            onClick={() => handleCopy(scriptTable, 'script')}
                            className="flex items-center space-x-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 hover:bg-slate-100"
                            aria-label="Copy Script"
                        >
                            <ClipboardIcon className={`h-5 w-5 transition-colors ${copiedStatus === 'script' ? 'text-green-500' : 'text-slate-500'}`} />
                            <span className={`transition-colors ${copiedStatus === 'script' ? 'text-green-600' : 'text-slate-700'}`}>{copiedStatus === 'script' ? 'Copied!' : 'Copy Script'}</span>
                        </button>
                    </div>
                  {renderScriptTable(scriptTable)}
                </div>
              )}
            </>
          )}
          
          {script && !finalJsonScript && (
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <p className="text-sm text-slate-600">Happy with the script? Or want to make some changes?</p>
                <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="no-narration-regen"
                      checked={noNarration}
                      onChange={(e) => setNoNarration(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                    />
                    <label htmlFor="no-narration-regen" className="text-sm text-slate-600">
                      No Narration Required
                    </label>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                        type="text" 
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                        placeholder="e.g., Make the ending more dramatic"
                        className="flex-grow px-4 py-2 text-sm text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                    />
                    <button 
                        onClick={() => onGenerate(duration, noNarration, suggestion)} 
                        disabled={isLoading || !suggestion}
                        className="px-4 py-2 text-sm bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 disabled:bg-slate-400"
                    >
                        Regenerate with Suggestion
                    </button>
                </div>
             </div>
          )}

          {finalJsonScript && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-semibold text-slate-800">Final Production JSON</h4>
                <button
                    onClick={() => handleCopy(finalJsonScript, 'json')}
                    className="flex items-center space-x-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 hover:bg-slate-100"
                    aria-label="Copy JSON"
                >
                    <ClipboardIcon className={`h-5 w-5 transition-colors ${copiedStatus === 'json' ? 'text-green-500' : 'text-slate-500'}`} />
                    <span className={`transition-colors ${copiedStatus === 'json' ? 'text-green-600' : 'text-slate-700'}`}>{copiedStatus === 'json' ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              {renderFinalJson(finalJsonScript)}
            </div>
          )}

        </main>

        {script && !finalJsonScript && (
            <footer className="p-6 bg-slate-100/70 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                    <label htmlFor="scene-duration" className="text-sm font-medium text-slate-600 whitespace-nowrap">Max Scene Duration (s):</label>
                    <input 
                        type="number"
                        id="scene-duration"
                        value={jsonSceneDuration}
                        onChange={(e) => setJsonSceneDuration(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md focus:ring-fuchsia-500 focus:border-fuchsia-500"
                        min="5"
                        max="60"
                        aria-label="Maximum JSON scene duration in seconds"
                    />
                </div>
                <button
                    onClick={() => onFinalize(jsonSceneDuration)}
                    disabled={isLoading}
                    className="px-6 py-3 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-500 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    ✅ Finalize Script as JSON
                </button>
            </footer>
        )}
      </div>
    </div>
  );
};

export default ScriptGeneratorModal;
