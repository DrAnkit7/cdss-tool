import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are an embedded Clinical Decision Support System (CDSS) assisting a physician during a patient consultation. Your role is to support — not replace — clinical judgment.

Given the presenting complaint, you will provide structured clinical guidance using the framework:
1. SOCRATES pain/symptom analysis questions (if relevant)
2. Key history questions to ask (grouped by system)
3. ICE — Ideas, Concerns, Expectations to explore
4. Past medical/surgical/drug/allergy/family/social history prompts (MAFTOSA)
5. Red flag symptoms to actively rule out
6. Top 3-5 differential diagnoses (most likely first)
7. Suggested examination findings to look for
8. Safety netting advice for the patient

Keep responses concise, clinically precise, and practical. Use UK clinical guidelines (NICE) as the reference standard. Format with clear section headers. Think like a senior GP or A&E registrar.

When asked follow-up questions mid-consultation, update your differentials and flag any changes to red flag status immediately.

Always end with: "⚠️ Red Flags to Rule Out:" section even if none are triggered.`;

const SUGGESTIONS = [
  "Chest pain", "Shortness of breath", "Abdominal pain", "Headache",
  "Dizziness", "Palpitations", "Back pain", "Leg swelling",
  "Cough", "Fever", "Fatigue", "Confusion"
];

export default function App() {
  const [complaint, setComplaint] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 1000);
    return () => clearInterval(interval);
  }, []);

  const callClaude = async (msgs) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-allow-browser": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: msgs
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "No response received.";
  };

  const startSession = async () => {
    if (!complaint.trim()) return;
    setLoading(true);
    setSessionStarted(true);
    const userMsg = { role: "user", content: `Presenting complaint: ${complaint}` };
    setMessages([{ type: "complaint", text: complaint }]);
    try {
      const reply = await callClaude([userMsg]);
      setMessages([
        { type: "complaint", text: complaint },
        { type: "assistant", text: reply }
      ]);
    } catch (e) {
      setMessages([
        { type: "complaint", text: complaint },
        { type: "error", text: "Connection error. Please try again." }
      ]);
    }
    setLoading(false);
  };

  const sendUpdate = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);

    const history = [];
    for (const m of messages) {
      if (m.type === "complaint") history.push({ role: "user", content: `Presenting complaint: ${m.text}` });
      else if (m.type === "assistant") history.push({ role: "assistant", content: m.text });
      else if (m.type === "user") history.push({ role: "user", content: m.text });
    }
    history.push({ role: "user", content: userText });
    setMessages(prev => [...prev, { type: "user", text: userText }]);

    try {
      const reply = await callClaude(history);
      setMessages(prev => [...prev, { type: "assistant", text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { type: "error", text: "Connection error." }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const reset = () => {
    setComplaint(""); setMessages([]); setInput("");
    setSessionStarted(false); setLoading(false);
  };

  const formatText = (text) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ") || (line.startsWith("**") && line.endsWith("**")))
        return <div key={i} className="section-header">{line.replace(/\*\*/g, "").replace(/## /, "")}</div>;
      if (line.startsWith("⚠️"))
        return <div key={i} className="red-flag-header">{line}</div>;
      if (line.match(/^\d+\./))
        return <div key={i} className="numbered">{line}</div>;
      if (line.startsWith("- ") || line.startsWith("• "))
        return <div key={i} className="bullet"><span className="bullet-dot">›</span>{line.replace(/^[-•] /, "")}</div>;
      if (line.trim() === "") return <div key={i} className="spacer" />;
      return <div key={i} className="body-line">{line}</div>;
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0e1a; }
        .app { min-height: 100vh; background: #0a0e1a; color: #e0e8ff; font-family: 'IBM Plex Sans', sans-serif; display: flex; flex-direction: column; }
        .header { background: linear-gradient(135deg, #0d1426 0%, #111827 100%); border-bottom: 1px solid #1e3a5f; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: #00ff88; box-shadow: 0 0 8px #00ff88; transition: opacity 0.5s; }
        .pulse-dot.off { opacity: 0.3; box-shadow: none; }
        .logo { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; color: #4da6ff; letter-spacing: 3px; text-transform: uppercase; }
        .logo span { color: #00ff88; }
        .header-right { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #4a6080; letter-spacing: 1px; }
        .reset-btn { background: transparent; border: 1px solid #1e3a5f; color: #4a6080; font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 6px 14px; border-radius: 4px; cursor: pointer; transition: all 0.2s; letter-spacing: 1px; }
        .reset-btn:hover { border-color: #4da6ff; color: #4da6ff; }
        .main { flex: 1; display: flex; flex-direction: column; max-width: 900px; width: 100%; margin: 0 auto; padding: 0 20px; }
        .landing { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
        .landing-badge { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 3px; color: #00ff88; text-transform: uppercase; margin-bottom: 24px; padding: 6px 16px; border: 1px solid #00ff8840; border-radius: 20px; background: #00ff8810; }
        .landing-title { font-size: 42px; font-weight: 300; color: #e0e8ff; line-height: 1.2; margin-bottom: 12px; letter-spacing: -1px; }
        .landing-title strong { font-weight: 600; color: #4da6ff; }
        .landing-sub { font-size: 15px; color: #4a6080; margin-bottom: 48px; max-width: 480px; line-height: 1.6; }
        .complaint-box { width: 100%; max-width: 560px; background: #0d1426; border: 1px solid #1e3a5f; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .complaint-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 2px; color: #4a6080; text-transform: uppercase; margin-bottom: 12px; }
        .complaint-input { width: 100%; background: #060a12; border: 1px solid #1e3a5f; border-radius: 8px; padding: 14px 16px; color: #e0e8ff; font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; outline: none; transition: border-color 0.2s; margin-bottom: 16px; }
        .complaint-input:focus { border-color: #4da6ff; }
        .complaint-input::placeholder { color: #2a3a55; }
        .suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .suggestion-chip { background: #060a12; border: 1px solid #1e3a5f; color: #4a6080; font-size: 12px; padding: 5px 12px; border-radius: 20px; cursor: pointer; transition: all 0.2s; font-family: 'IBM Plex Sans', sans-serif; }
        .suggestion-chip:hover { border-color: #4da6ff; color: #4da6ff; background: #0d1e35; }
        .start-btn { width: 100%; background: linear-gradient(135deg, #1a4a8a, #0d2a5a); border: 1px solid #2a6abf; color: #4da6ff; font-family: 'IBM Plex Mono', monospace; font-size: 13px; letter-spacing: 2px; padding: 14px; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
        .start-btn:hover:not(:disabled) { background: linear-gradient(135deg, #204faa, #1a3a7a); box-shadow: 0 0 20px #4da6ff30; }
        .start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .disclaimer { font-size: 11px; color: #2a3a55; max-width: 480px; line-height: 1.5; text-align: center; }
        .session { flex: 1; display: flex; flex-direction: column; padding: 20px 0; }
        .messages { flex: 1; display: flex; flex-direction: column; gap: 16px; padding-bottom: 20px; }
        .msg-complaint { background: #060a12; border: 1px solid #1e3a5f; border-left: 3px solid #4da6ff; border-radius: 8px; padding: 16px 20px; }
        .msg-complaint-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #4da6ff; text-transform: uppercase; margin-bottom: 6px; }
        .msg-complaint-text { font-size: 18px; font-weight: 500; color: #e0e8ff; }
        .msg-user { align-self: flex-end; background: #0d1e35; border: 1px solid #1e4a7f; border-radius: 8px 8px 2px 8px; padding: 12px 16px; max-width: 70%; font-size: 14px; color: #a0c4ff; }
        .msg-user-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 1px; color: #2a5a9f; margin-bottom: 4px; text-transform: uppercase; }
        .msg-assistant { background: #080d1a; border: 1px solid #1a2d4a; border-radius: 2px 8px 8px 8px; padding: 20px 24px; }
        .msg-assistant-label { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 2px; color: #00ff88; margin-bottom: 16px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
        .msg-assistant-label::before { content: ''; display: inline-block; width: 6px; height: 6px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 6px #00ff88; }
        .section-header { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 2px; color: #4da6ff; text-transform: uppercase; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #1e3a5f; }
        .red-flag-header { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 2px; color: #ff4444; text-transform: uppercase; margin: 16px 0 8px; padding: 8px 12px; background: #ff000015; border: 1px solid #ff444430; border-radius: 4px; }
        .bullet { display: flex; gap: 10px; padding: 3px 0; font-size: 14px; color: #b0c8e8; line-height: 1.5; }
        .bullet-dot { color: #4da6ff; font-weight: 600; flex-shrink: 0; }
        .numbered { padding: 3px 0 3px 4px; font-size: 14px; color: #b0c8e8; line-height: 1.5; }
        .body-line { font-size: 14px; color: #8090a8; line-height: 1.6; padding: 1px 0; }
        .spacer { height: 6px; }
        .msg-error { background: #1a0808; border: 1px solid #4a1515; border-radius: 8px; padding: 12px 16px; color: #ff6666; font-size: 13px; }
        .loading-msg { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: #080d1a; border: 1px solid #1a2d4a; border-radius: 8px; }
        .loading-dots { display: flex; gap: 4px; }
        .loading-dot { width: 6px; height: 6px; background: #00ff88; border-radius: 50%; animation: blink 1.2s infinite; }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; box-shadow: 0 0 6px #00ff88; } }
        .loading-text { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #4a6080; letter-spacing: 1px; }
        .input-area { position: sticky; bottom: 0; background: linear-gradient(to top, #0a0e1a 80%, transparent); padding: 16px 0 20px; }
        .input-row { display: flex; gap: 10px; background: #0d1426; border: 1px solid #1e3a5f; border-radius: 10px; padding: 8px 8px 8px 16px; transition: border-color 0.2s; }
        .input-row:focus-within { border-color: #2a5a9f; }
        .update-input { flex: 1; background: transparent; border: none; color: #e0e8ff; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; outline: none; padding: 8px 0; }
        .update-input::placeholder { color: #2a3a55; }
        .send-btn { background: linear-gradient(135deg, #1a4a8a, #0d2a5a); border: 1px solid #2a6abf; color: #4da6ff; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 1px; padding: 10px 20px; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .send-btn:hover:not(:disabled) { background: linear-gradient(135deg, #204faa, #1a3a7a); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .input-hint { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #1e3a5f; text-align: center; margin-top: 8px; letter-spacing: 1px; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-left">
            <div className={`pulse-dot ${pulse ? "" : "off"}`} />
            <div className="logo">CDSS <span>//</span> Clinical AI</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {sessionStarted && <button className="reset-btn" onClick={reset}>NEW PATIENT</button>}
            <div className="header-right">NICE GUIDELINES · UK</div>
          </div>
        </div>

        <div className="main">
          {!sessionStarted ? (
            <div className="landing">
              <div className="landing-badge">Clinical Decision Support</div>
              <h1 className="landing-title">Think faster.<br /><strong>Miss nothing.</strong></h1>
              <p className="landing-sub">Enter the presenting complaint and get structured clinical guidance — history questions, red flags, differentials, and safety netting — powered by NICE guidelines.</p>
              <div className="complaint-box">
                <div className="complaint-label">Presenting Complaint</div>
                <input className="complaint-input" placeholder="e.g. chest pain, shortness of breath..." value={complaint} onChange={e => setComplaint(e.target.value)} onKeyDown={e => e.key === "Enter" && startSession()} autoFocus />
                <div className="suggestions">
                  {SUGGESTIONS.map(s => <button key={s} className="suggestion-chip" onClick={() => setComplaint(s)}>{s}</button>)}
                </div>
                <button className="start-btn" onClick={startSession} disabled={!complaint.trim() || loading}>
                  {loading ? "Analysing..." : "Start Consultation →"}
                </button>
              </div>
              <p className="disclaimer">⚕ For physician use only. This tool supports — it does not replace — clinical judgment.</p>
            </div>
          ) : (
            <div className="session">
              <div className="messages">
                {messages.map((m, i) => {
                  if (m.type === "complaint") return <div key={i} className="msg-complaint"><div className="msg-complaint-label">Presenting Complaint</div><div className="msg-complaint-text">{m.text}</div></div>;
                  if (m.type === "user") return <div key={i} className="msg-user"><div className="msg-user-label">Update</div>{m.text}</div>;
                  if (m.type === "assistant") return <div key={i} className="msg-assistant"><div className="msg-assistant-label">Clinical Guidance</div>{formatText(m.text)}</div>;
                  if (m.type === "error") return <div key={i} className="msg-error">{m.text}</div>;
                  return null;
                })}
                {loading && <div className="loading-msg"><div className="loading-dots"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div><div className="loading-text">Analysing clinical data...</div></div>}
                <div ref={bottomRef} />
              </div>
              <div className="input-area">
                <div className="input-row">
                  <input ref={inputRef} className="update-input" placeholder="Add findings: 'patient has fever', 'pain radiates to jaw'..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendUpdate()} disabled={loading} />
                  <button className="send-btn" onClick={sendUpdate} disabled={!input.trim() || loading}>UPDATE →</button>
                </div>
                <div className="input-hint">Add new findings, examination results, or ask about a specific differential</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
