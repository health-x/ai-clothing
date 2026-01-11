
import React, { useState, useEffect } from 'react';
import { AppStep, HistoryItem } from './types';
import { PERSON_PRESETS, CLOTHES_PRESETS } from './constants';
import { generateClothingImage, generateTryOnResult, urlToBase64 } from './services/geminiService';

const MAX_HISTORY = 10;

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.SELECT_PERSON);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedClothes, setSelectedClothes] = useState<string | null>(null);
  const [clothesPresets, setClothesPresets] = useState<string[]>(CLOTHES_PRESETS);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingClothes, setIsGeneratingClothes] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fashion_history_v2');
      if (saved) setHistory(JSON.parse(saved).slice(0, MAX_HISTORY));
    } catch (e) {
      console.warn('History load failed');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fashion_history_v2', JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch (e) {
      console.warn('History save failed - likely quota full');
    }
  }, [history]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'clothes') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('图片太大，请上传 5MB 以内的图片');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (type === 'person') setSelectedPerson(result);
        else setSelectedClothes(result);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAIViaPrompt = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingClothes(true);
    setError(null);
    try {
      const imageUrl = await generateClothingImage(aiPrompt);
      setClothesPresets(prev => [imageUrl, ...prev]);
      setSelectedClothes(imageUrl);
      setAiPrompt('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingClothes(false);
    }
  };

  const startTryOn = async () => {
    if (!selectedPerson || !selectedClothes) return;
    setStep(AppStep.GENERATING);
    setError(null);
    try {
      const personB64 = selectedPerson.startsWith('data:') ? selectedPerson : await urlToBase64(selectedPerson);
      const clothesB64 = selectedClothes.startsWith('data:') ? selectedClothes : await urlToBase64(selectedClothes);
      
      const result = await generateTryOnResult(personB64, clothesB64);
      setFinalResult(result);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        imageUrl: result,
        personUrl: selectedPerson,
        clothesUrl: selectedClothes,
        timestamp: Date.now()
      };
      setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY));
      setStep(AppStep.RESULT);
    } catch (err: any) {
      setError(err.message);
      setStep(selectedClothes ? AppStep.SELECT_CLOTHES : AppStep.SELECT_PERSON);
    }
  };

  const resetAll = () => {
    setStep(AppStep.SELECT_PERSON);
    setSelectedPerson(null);
    setSelectedClothes(null);
    setFinalResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 pt-6 md:pt-10">
        {/* Header */}
        <header className="mb-8 text-center px-4">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">AI 换装实验室</h1>
          <p className="text-slate-500 text-sm md:text-base">基于 Gemini Nano Banana 的视觉生成能力</p>
        </header>

        {/* Status Display - Adaptive for Mobile */}
        <div className="flex justify-between items-center gap-2 md:gap-6 mb-10 h-32 md:h-48 px-2">
          <div className={`flex-1 bg-white rounded-xl md:rounded-2xl shadow-md overflow-hidden transition-all duration-300 relative ${step >= AppStep.SELECT_PERSON ? 'ring-2 ring-indigo-500 scale-105 z-10' : 'opacity-60'} ${step < AppStep.RESULT ? 'card-tilt-1' : ''}`}>
            {selectedPerson ? (
              <img src={selectedPerson} className="w-full h-full object-cover" alt="Selected" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-user text-xl md:text-3xl"></i>
              </div>
            )}
            <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-indigo-500 text-white text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold">1</div>
          </div>

          <div className={`flex-1 bg-white rounded-xl md:rounded-2xl shadow-md overflow-hidden transition-all duration-300 relative ${step >= AppStep.SELECT_CLOTHES ? 'ring-2 ring-indigo-500 scale-105 z-10' : 'opacity-60'} ${step < AppStep.RESULT ? 'card-tilt-2' : ''}`}>
            {selectedClothes ? (
              <img src={selectedClothes} className="w-full h-full object-cover" alt="Clothes" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-shirt text-xl md:text-3xl"></i>
              </div>
            )}
            <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-indigo-500 text-white text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold">2</div>
          </div>

          <div className={`flex-1 bg-white rounded-xl md:rounded-2xl shadow-lg overflow-hidden transition-all duration-300 relative ${step === AppStep.RESULT ? 'ring-2 ring-green-500 scale-105 z-10' : 'opacity-60'} ${step < AppStep.RESULT ? 'card-tilt-3' : ''}`}>
            {finalResult ? (
              <img src={finalResult} className="w-full h-full object-cover" alt="Result" />
            ) : step === AppStep.GENERATING ? (
              <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fas fa-magic text-xl md:text-3xl"></i>
              </div>
            )}
            <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-green-500 text-white text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold">3</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl p-5 md:p-8 min-h-[420px] border border-slate-100 relative">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2 border border-red-100 animate-bounce">
              <i className="fas fa-circle-exclamation mt-1"></i>
              <span>{error}</span>
            </div>
          )}

          {step === AppStep.SELECT_PERSON && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <h2 className="text-xl font-bold">选择模特人像</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 group">
                  <i className="fas fa-plus text-slate-400 group-hover:text-indigo-500"></i>
                  <span className="text-[10px] text-slate-500">上传</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'person')} />
                </label>
                {PERSON_PRESETS.map((url, i) => (
                  <button key={i} onClick={() => setSelectedPerson(url)} className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedPerson === url ? 'border-indigo-500 scale-90 ring-4 ring-indigo-50' : 'border-transparent hover:border-slate-200'}`}>
                    <img src={url} className="w-full h-full object-cover" alt="preset" />
                  </button>
                ))}
              </div>
              <button disabled={!selectedPerson} onClick={() => setStep(AppStep.SELECT_CLOTHES)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40 transition-all text-lg">
                选好了，去选衣服 <i className="fas fa-arrow-right ml-2"></i>
              </button>
            </div>
          )}

          {step === AppStep.SELECT_CLOTHES && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <h2 className="text-xl font-bold">选择或生成衣物</h2>
                </div>
                <button onClick={() => setStep(AppStep.SELECT_PERSON)} className="text-sm text-indigo-600 font-medium">上一步</button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI 创意工坊</p>
                <div className="flex gap-2">
                  <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="描述你想要的衣服..." className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  <button onClick={generateAIViaPrompt} disabled={isGeneratingClothes || !aiPrompt} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {isGeneratingClothes ? <i className="fas fa-spinner animate-spin"></i> : '生成'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 group">
                  <i className="fas fa-plus text-slate-400 group-hover:text-indigo-500"></i>
                  <span className="text-[10px] text-slate-500">上传</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'clothes')} />
                </label>
                {clothesPresets.map((url, i) => (
                  <button key={i} onClick={() => setSelectedClothes(url)} className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${selectedClothes === url ? 'border-indigo-500 scale-90 ring-4 ring-indigo-50' : 'border-transparent hover:border-slate-200'}`}>
                    <img src={url} className="w-full h-full object-cover" alt="clothes preset" />
                  </button>
                ))}
              </div>
              <button disabled={!selectedClothes} onClick={startTryOn} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40 transition-all text-lg flex items-center justify-center gap-2">
                <i className="fas fa-magic"></i> 开启魔法试穿
              </button>
            </div>
          )}

          {step === AppStep.GENERATING && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">正在塑造你的时尚造型</h3>
                <p className="text-slate-500 text-sm">正在努力对齐服饰细节与模特身材...</p>
              </div>
            </div>
          )}

          {step === AppStep.RESULT && finalResult && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                <h2 className="text-xl font-bold">生成完成！</h2>
              </div>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 aspect-[3/4] bg-slate-50 rounded-3xl overflow-hidden shadow-inner border border-slate-100">
                  <img src={finalResult} className="w-full h-full object-cover" alt="Final Result" />
                </div>
                <div className="w-full md:w-48 flex flex-col gap-3">
                  <button onClick={() => { const l = document.createElement('a'); l.href = finalResult; l.download = 'tryon.png'; l.click(); }} className="py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"><i className="fas fa-download mr-2"></i>保存作品</button>
                  <button onClick={resetAll} className="py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">重新开始</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Gallery */}
        <div className="mt-16 px-2">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <i className="fas fa-history text-slate-400"></i> 最近作品
          </h2>
          {history.length === 0 ? (
            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">还没有作品，开始你的第一次试穿吧</div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x px-1">
              {history.map(item => (
                <div key={item.id} onClick={() => {setFinalResult(item.imageUrl); setStep(AppStep.RESULT);}} className="flex-shrink-0 w-32 md:w-40 snap-start space-y-2 cursor-pointer group">
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-sm border-2 border-white group-hover:border-indigo-500 transition-all transform group-hover:-translate-y-1">
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="history" />
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1/2 aspect-square rounded-lg overflow-hidden bg-slate-100"><img src={item.personUrl} className="w-full h-full object-cover opacity-50" /></div>
                    <div className="w-1/2 aspect-square rounded-lg overflow-hidden bg-slate-100"><img src={item.clothesUrl} className="w-full h-full object-cover opacity-50" /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
