"use client";
import { Icon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { tri, type Locale } from "@/lib/i18n";
type Speech = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
export function TripDictation({ loc, disabled, onText, onActive }: { loc: Locale; disabled: boolean; onText: (text: string) => void; onActive: (active: boolean) => void }) {
  const tr = (s: string) => tri(loc, s);
  const [server, setServer] = useState(false), [native, setNative] = useState(false), [recordable, setRecordable] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "listening" | "sending">("idle"), [error, setError] = useState("");
  const active = useRef(true), lock = useRef(false), speech = useRef<Speech | null>(null), recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), controller = useRef<AbortController | null>(null);
  useEffect(() => { onActive(state !== "idle"); return () => onActive(false); }, [state, onActive]);
  const stopTracks = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; if (timer.current) clearTimeout(timer.current); };
  useEffect(() => {
    active.current = true;
    const w = window as SpeechWindow; setNative(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    setRecordable(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
    void fetch("/api/trips/transcribe").then((r) => r.ok ? r.json() : null).then((j) => { if (active.current) setServer(!!j?.enabled); }).catch(() => {});
    return () => { active.current = false; controller.current?.abort(); if (speech.current) { speech.current.onresult = speech.current.onerror = speech.current.onend = null; speech.current.abort(); } if (recorder.current?.state === "recording") { recorder.current.onstop = null; recorder.current.stop(); } stopTracks(); };
  }, []);
  const fail = (code: string) => {
    if (!active.current) return;
    setError(tr(code === "not-allowed" || code === "NotAllowedError" ? "Accesul la microfon este blocat. Permite microfonul din setările site-ului și încearcă din nou.|Microphone access is blocked. Allow it in site settings and try again.|Mikrofon jest zablokowany. Zezwól na dostęp w ustawieniach strony." : code === "no-speech" || code === "silence" ? "Nu am auzit nimic. Încearcă din nou sau scrie textul.|No speech detected. Try again or type your text.|Nie wykryto mowy. Spróbuj ponownie lub wpisz tekst." : "Dictarea nu a reușit. Încearcă din nou sau folosește microfonul tastaturii telefonului.|Dictation failed. Try again or use your phone keyboard microphone.|Dyktowanie nie powiodło się. Spróbuj ponownie lub użyj mikrofonu klawiatury telefonu."));
    lock.current = false; setState("idle"); stopTracks();
  };
  async function start() {
    if (state === "listening") { recorder.current?.state === "recording" ? recorder.current.stop() : speech.current?.stop(); return; }
    if (lock.current || disabled) return; lock.current = true; setError(""); setState("starting");
    if (server && recordable) {
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active.current) { media.getTracks().forEach((t) => t.stop()); return; }
        stream.current = media;
        const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((x) => MediaRecorder.isTypeSupported(x));
        const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined); recorder.current = rec;
        const chunks: Blob[] = []; let bytes = 0;
        rec.ondataavailable = (e) => { if (e.data.size) { chunks.push(e.data); bytes += e.data.size; if (bytes > 1_900_000 && rec.state === "recording") rec.stop(); } };
        rec.onerror = () => fail("audio");
        rec.onstop = async () => {
          stopTracks(); if (!active.current) return;
          setState("sending");
          const body = new FormData(), type = rec.mimeType || "audio/webm";
          body.set("audio", new Blob(chunks, { type }), type.includes("mp4") ? "dictation.mp4" : type.includes("ogg") ? "dictation.ogg" : "dictation.webm"); body.set("language", loc);
          controller.current = new AbortController();
          try {
            const response = await fetch("/api/trips/transcribe", { method: "POST", body, signal: controller.current.signal });
            const j = await response.json(); if (!response.ok || !j.text) throw new Error(j.error || "service");
            if (active.current) { lock.current = false; setState("idle"); onText(j.text); }
          } catch (e) { fail((e as Error).message); }
        };
        rec.start(1000); setState("listening"); timer.current = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 60000);
      } catch (e) { fail((e as Error).name); }
    } else {
      const w = window as SpeechWindow, C = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!C) { fail("unavailable"); return; }
      const s = new C(); speech.current = s; s.lang = { ro: "ro-RO", en: "en-GB", pl: "pl-PL" }[loc]; s.interimResults = false;
      let heard = false, failed = false;
      s.onresult = (e) => { const text = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim(); if (text && active.current) { heard = true; onText(text); } };
      s.onerror = (e) => { failed = true; fail(e.error); };
      s.onend = () => { if (!active.current) return; if (!heard && !failed) fail("no-speech"); else { lock.current = false; setState("idle"); } };
      try { s.start(); setState("listening"); } catch { fail("start"); }
    }
  }
  const available = native || (server && recordable);
  return <div><button type="button" className="btn sec sm" disabled={(!available || disabled || state === "starting" || state === "sending") && state !== "listening"} aria-pressed={state === "listening"} onClick={start}><Icon name="mic" size={18} /><span>{state === "listening" ? tr("■ Oprește dictarea|■ Stop dictation|■ Zatrzymaj dyktowanie") : state === "sending" ? tr("Se transcrie…|Transcribing…|Transkrypcja…") : tr("Dictează|Dictate|Dyktuj")}</span></button>
    <p className="hint" role="status">{state === "listening" ? tr("Te ascult. Oprește când ai terminat (maximum 60 secunde).|Listening. Stop when done (maximum 60 seconds).|Słucham. Zatrzymaj po zakończeniu (maks. 60 sekund).") : !available ? tr("Folosește microfonul tastaturii telefonului sau scrie textul.|Use your phone keyboard microphone or type your text.|Użyj mikrofonu klawiatury telefonu lub wpisz tekst.") : server && recordable ? tr("La dictare, audio-ul este trimis la Groq pentru transcriere. Verifici textul înainte de salvare.|Dictation sends audio to Groq for transcription. Review the text before saving.|Dźwięk jest wysyłany do Groq do transkrypcji. Sprawdź tekst przed zapisaniem.") : tr("Dictare prin browser. Verifică textul înainte de salvare.|Browser dictation. Review the text before saving.|Dyktowanie przez przeglądarkę. Sprawdź tekst przed zapisaniem.")}</p>
    {error ? <p className="msg err" role="alert">{error}</p> : null}</div>;
}
