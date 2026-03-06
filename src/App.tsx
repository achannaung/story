import React, { useState, useEffect, useRef } from "react";
import { Moon, Star, Sparkles, BookOpen, Clock, Heart, ArrowRight, ArrowLeft, RefreshCw, Wand2 } from "lucide-react";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// --- Constants & Config ---
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  size: Math.random() * 2.5 + 1,
  delay: Math.random() * 4,
  duration: Math.random() * 3 + 2,
}));

const INTERESTS = [
  { label: "Space & Rockets", emoji: "🚀" },
  { label: "Outer Space & Planets", emoji: "🪐" },
  { label: "Dinosaurs", emoji: "🦕" },
  { label: "Ocean & Fish", emoji: "🐠" },
  { label: "Superheroes", emoji: "🦸" },
  { label: "Animals & Farms", emoji: "🐾" },
  { label: "Trucks & Trains", emoji: "🚂" },
  { label: "Dragons & Magic", emoji: "🐉" },
  { label: "Mystical Creatures", emoji: "🦄" },
  { label: "Magical Objects", emoji: "🪄" },
  { label: "Sports & Games", emoji: "⚽" },
  { label: "Fairies & Forest", emoji: "🧚" },
  { label: "Robots & Gadgets", emoji: "🤖" },
  { label: "Pirates & Treasure", emoji: "🏴‍☠️" },
  { label: "Custom", emoji: "✨" },
];

const STYLES = [
  { label: "Funny & Silly", emoji: "😄", desc: "Giggles guaranteed" },
  { label: "Sweet & Warm", emoji: "🥰", desc: "Cozy and heartfelt" },
  { label: "Adventurous", emoji: "🗺️", desc: "Brave and exciting" },
  { label: "Magical", emoji: "✨", desc: "Wondrous and dreamlike" },
  { label: "Calm & Peaceful", emoji: "🌙", desc: "Quiet and soothing" },
  { label: "Mysterious", emoji: "🔍", desc: "Curious and intriguing" },
];

const LENGTHS = [
  { label: "Short", emoji: "⭐", desc: "~2 min read", value: "short (about 200 words)" },
  { label: "Medium", emoji: "⭐⭐", desc: "~4 min read", value: "medium (about 400 words)" },
  { label: "Long", emoji: "⭐⭐⭐", desc: "~7 min read", value: "long (about 600 words)" },
];

const LANGUAGES = [
  { label: "English", emoji: "🇺🇸" },
  { label: "Burmese", emoji: "🇲🇲" },
  { label: "Burmese & English", emoji: "🔄" },
];

const LESSONS = [
  { label: "Be Kind", emoji: "💛", desc: "Treat others with care" },
  { label: "Be Brave", emoji: "🦁", desc: "Face your fears" },
  { label: "Share & Give", emoji: "🤝", desc: "Generosity is joy" },
  { label: "Try Your Best", emoji: "💪", desc: "Effort always matters" },
  { label: "Tell the Truth", emoji: "🌟", desc: "Honesty builds trust" },
  { label: "Believe in Yourself", emoji: "🔮", desc: "You are enough" },
];

// --- API Helper ---
const generateStoryWithGemini = async (prompt: string, retryCount = 0): Promise<string | undefined> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a world-class children's author specializing in soothing bedtime stories for 4-year-olds. Your stories are gentle, imaginative, and always end with a sleepy, comforting conclusion. If writing in Burmese, use the name 'နိုအာ' for the main character Noah.",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return response.text;
  } catch (error) {
    if (retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return generateStoryWithGemini(prompt, retryCount + 1);
    }
    throw error;
  }
};

// --- Sub-components ---

const StarField = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    {STARS.map((star) => (
      <div
        key={star.id}
        className="absolute rounded-full bg-white opacity-0 animate-twinkle"
        style={{
          top: `${star.top}%`,
          left: `${star.left}%`,
          width: `${star.size}px`,
          height: `${star.size}px`,
          animationDuration: `${star.duration}s`,
          animationDelay: `${star.delay}s`,
        }}
      />
    ))}
  </div>
);

const ProgressIndicator = ({ step }: { step: number }) => (
  <div className="flex gap-2 justify-center mb-8">
    {[1, 2, 3, 4, 5].map((s) => (
      <div
        key={s}
        className={`h-2 rounded-full transition-all duration-500 ease-out ${
          s === step ? "w-8 bg-amber-400" : s < step ? "w-2 bg-amber-200/50" : "w-2 bg-white/10"
        }`}
      />
    ))}
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 ${className}`}>
    {children}
  </div>
);

const StepHeader = ({ step, title, subtitle }: { step: number, title: string, subtitle: string }) => (
  <div className="text-center mb-8">
    <span className="inline-block px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-400 mb-4">
      Step {step} of 5
    </span>
    <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2 leading-tight">
      {title}
    </h2>
    <p className="text-white/50 text-sm font-medium">{subtitle}</p>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [step, setStep] = useState(1);
  const [selections, setSelections] = useState({
    interest: "",
    customInterest: "",
    style: "",
    length: "",
    language: "",
    lesson: "",
  });
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = (key: string, value: string) => {
    setSelections((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const generate = async () => {
    setLoading(true);
    setError("");
    setStep(6);

    const prompt = `Write a ${selections.length} children's bedtime story for a 4-year-old boy named Noah.
    
    Theme: ${selections.interest === "Custom" ? selections.customInterest : selections.interest}
    Style: ${selections.style}
    Language: ${selections.language}
    Moral/Lesson: ${selections.lesson}
    
    Requirements:
    1. Start with a magical title on the first line.
    2. Noah is the hero. If writing in Burmese, use the name "နိုအာ" for Noah.
    3. Use sensory language (soft sounds, cozy smells).
    4. Ensure the ending is very sleepy and calm.
    5. Avoid any scary elements.
    6. No markdown bolding or headers. Use plain text paragraphs.`;

    try {
      const result = await generateStoryWithGemini(prompt);
      setStory(result || "");
    } catch (err) {
      setError("The stars are a bit cloudy tonight. Please try weaving the story again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelections({ interest: "", customInterest: "", style: "", length: "", language: "", lesson: "" });
    setStory("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#0d0520] text-slate-100 font-sans selection:bg-amber-400/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-serif { font-family: 'Lora', serif; }
        
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        .animate-twinkle { animation: twinkle linear infinite; }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,#1a0840_0%,#0d0520_100%)] z-0" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(72,52,144,0.15)_0%,transparent_50%)] z-0 pointer-events-none" />
      <StarField />

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 flex flex-col items-center min-h-screen">
        {/* Branding */}
        <div className="text-center mb-12 animate-in fade-in zoom-in duration-1000">
          <div className="inline-block p-4 rounded-full bg-white/5 mb-6 animate-float">
            <Moon className="w-12 h-12 text-amber-300 fill-amber-300/20" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-3 tracking-tight">
            Noah's Storybook
          </h1>
          <p className="text-white/40 font-medium tracking-wide">Magic woven from the stars</p>
        </div>

        {step < 5 && <ProgressIndicator step={step} />}

        <div className="w-full">
          {/* Step 1: Interests */}
          {step === 1 && (
            <Card>
              <StepHeader 
                step={1} 
                title="What sparks joy tonight?" 
                subtitle="Choose a theme for Noah's dream adventure" 
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {INTERESTS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSelect("interest", item.label)}
                    className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all duration-300 border ${
                      selections.interest === item.label 
                        ? "bg-amber-400/20 border-amber-400 border-2 shadow-[0_0_25px_rgba(251,191,36,0.2)] scale-110" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-3xl">{item.emoji}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-center">{item.label}</span>
                  </button>
                ))}
              </div>
              {selections.interest === "Custom" && (
                <input
                  type="text"
                  placeholder="What should Noah dream about?"
                  value={selections.customInterest}
                  onChange={(e) => handleSelect("customInterest", e.target.value)}
                  className="w-full mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400"
                />
              )}
              <button
                disabled={!selections.interest || (selections.interest === "Custom" && !selections.customInterest)}
                onClick={nextStep}
                className="w-full mt-8 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl shadow-amber-900/20 disabled:opacity-30 flex items-center justify-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </Card>
          )}

          {/* Step 2: Vibe */}
          {step === 2 && (
            <Card>
              <StepHeader 
                step={2} 
                title="The mood of the night" 
                subtitle="How should the story feel for Noah?" 
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STYLES.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSelect("style", item.label)}
                    className={`p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 border text-left ${
                      selections.style === item.label 
                        ? "bg-amber-400/20 border-amber-400 border-2 shadow-[0_0_25px_rgba(251,191,36,0.2)] scale-[1.02]" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className="text-xs text-white/40">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={prevStep} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={!selections.style}
                  onClick={nextStep}
                  className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl disabled:opacity-30"
                >
                  Continue
                </button>
              </div>
            </Card>
          )}

          {/* Step 3: Length */}
          {step === 3 && (
            <Card>
              <StepHeader 
                step={3} 
                title="Time for sleep" 
                subtitle="How long shall we spend in dreamland?" 
              />
              <div className="grid grid-cols-1 gap-3">
                {LENGTHS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSelect("length", item.value)}
                    className={`p-6 rounded-2xl flex items-center justify-between transition-all duration-300 border ${
                      selections.length === item.value 
                        ? "bg-amber-400/20 border-amber-400 border-2 shadow-[0_0_25px_rgba(251,191,36,0.2)]" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="font-bold">{item.label}</div>
                        <div className="text-xs text-white/40">{item.desc}</div>
                      </div>
                    </div>
                    <span className="text-xl">{item.emoji}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={prevStep} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={!selections.length}
                  onClick={nextStep}
                  className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl disabled:opacity-30"
                >
                  Continue
                </button>
              </div>
            </Card>
          )}

          {/* Step 4: Language */}
          {step === 4 && (
            <Card>
              <StepHeader 
                step={4} 
                title="Choose a language" 
                subtitle="In which language should the story be?" 
              />
              <div className="grid grid-cols-1 gap-3">
                {LANGUAGES.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSelect("language", item.label)}
                    className={`p-6 rounded-2xl flex items-center justify-between transition-all duration-300 border ${
                      selections.language === item.label 
                        ? "bg-amber-400/20 border-amber-400 border-2 shadow-[0_0_25px_rgba(251,191,36,0.2)]" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-xl">{item.emoji}</div>
                      <div className="font-bold">{item.label}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={prevStep} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={!selections.language}
                  onClick={nextStep}
                  className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl disabled:opacity-30"
                >
                  Continue
                </button>
              </div>
            </Card>
          )}

          {/* Step 5: Lesson */}
          {step === 5 && (
            <Card>
              <StepHeader 
                step={5} 
                title="A gift for the heart" 
                subtitle="What gentle lesson should the story carry?" 
              />
              <div className="grid grid-cols-2 gap-3">
                {LESSONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSelect("lesson", item.label)}
                    className={`p-5 rounded-2xl flex flex-col items-center gap-2 transition-all duration-300 border text-center ${
                      selections.lesson === item.label 
                        ? "bg-amber-400/20 border-amber-400 border-2 shadow-[0_0_25px_rgba(251,191,36,0.2)] scale-105" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-3xl">{item.emoji}</span>
                    <div className="font-bold text-xs">{item.label}</div>
                    <div className="text-[10px] text-white/40 leading-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={prevStep} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={!selections.lesson || !selections.language}
                  onClick={generate}
                  className="flex-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl shadow-amber-900/30 disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-5 h-5" /> Weave Story
                </button>
              </div>
            </Card>
          )}

          {/* Step 6: Loading / Result */}
          {step === 6 && (
            <div className="animate-in fade-in duration-1000">
              {loading ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="relative mb-8">
                    <Sparkles className="w-16 h-16 text-amber-300 animate-pulse" />
                    <div className="absolute inset-0 bg-amber-400/20 blur-2xl rounded-full" />
                  </div>
                  <h3 className="text-xl font-serif text-white mb-2">Weaving Noah's Story...</h3>
                  <p className="text-white/40 text-sm italic">Mixing star-dust and moonlight whispers</p>
                </div>
              ) : error ? (
                <Card className="text-center">
                  <div className="text-amber-400 text-4xl mb-4 text-center">✨</div>
                  <p className="text-white/70 mb-6">{error}</p>
                  <button onClick={generate} className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-xl font-bold transition-colors">
                    Try Again
                  </button>
                </Card>
              ) : (
                <div className="space-y-8 max-w-xl mx-auto">
                  {/* Meta Tags */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {[selections.interest, selections.style, selections.lesson].map(t => (
                      <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/40 font-bold uppercase tracking-widest">{t}</span>
                    ))}
                  </div>

                  <Card className="p-10 md:p-14 bg-white/5 backdrop-blur-2xl">
                    <div className="prose prose-invert prose-amber max-w-none">
                      {story.split('\n').map((line, i) => {
                        const trimmed = line.trim();
                        if (!trimmed) return <div key={i} className="h-4" />;
                        if (i === 0) return (
                          <h2 key={i} className="text-3xl md:text-4xl font-serif text-center text-amber-300 mb-12 leading-tight italic">
                            {trimmed}
                          </h2>
                        );
                        return (
                          <p key={i} className="font-serif text-lg md:text-xl leading-relaxed text-white/90 mb-6 last:mb-0">
                            {trimmed}
                          </p>
                        );
                      })}
                    </div>
                    <div className="mt-16 text-center text-amber-300/30 text-2xl tracking-[1em]">
                      ✦ ✦ ✦
                    </div>
                  </Card>

                  <div className="text-center italic text-white/30 text-sm font-serif">
                    Goodnight and sweet dreams, Noah. 🌙
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <button 
                      onClick={reset}
                      className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" /> New Adventure
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="flex-1 p-4 rounded-2xl bg-amber-400 text-slate-900 font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                      <BookOpen className="w-4 h-4" /> Keep this Story
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 py-8 text-center text-white/10 text-[10px] font-black uppercase tracking-[0.2em] w-full border-t border-white/5">
          Made with Love for Noah • Created by AChann@2026
        </footer>
      </main>
    </div>
  );
}
