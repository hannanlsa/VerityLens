/**
 * VerityLens · ASR Module · Web Speech API（v0.7.0）
 *
 * 浏览器端语音识别
 * 支持：实时语音转文字、音频文件转写（需云端）、置信度评分
 */

const VerityASR = {
  recognition: null,
  listening: false,
  supported: false,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      VerityCore.log('Web Speech API not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';
    this.supported = true;
    VerityCore.log('ASR initialized');
  },

  startListening(onResult, onError) {
    if (!this.supported) this.init();
    if (!this.recognition) {
      onError?.('ASR not supported');
      return;
    }

    if (this.listening) return;
    this.listening = true;

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let confidence = 0;
      let count = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          confidence += result[0].confidence;
          count++;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      onResult?.({
        text: finalTranscript || interimTranscript,
        confidence: count > 0 ? confidence / count : 0,
        isFinal: !!finalTranscript,
        language: this.recognition.lang
      });
    };

    this.recognition.onerror = (event) => {
      VerityCore.log('ASR error:', event.error);
      onError?.(event.error);
      if (event.error !== 'no-speech') {
        this.listening = false;
      }
    };

    this.recognition.onend = () => {
      if (this.listening) {
        try { this.recognition.start(); } catch {}
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      VerityCore.log('ASR start failed:', err.message);
      this.listening = false;
    }
  },

  stopListening() {
    if (this.recognition && this.listening) {
      this.listening = false;
      this.recognition.stop();
    }
  },

  async transcribeAudio(audioBlob) {
    if (!this.supported) this.init();
    if (!this.recognition) {
      return { text: '', confidence: 0, language: 'zh-CN', duration: 0, error: 'ASR not available' };
    }

    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      const result = { text: '', confidence: 0, language: 'zh-CN', duration: 0 };

      const start = Date.now();

      this.recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            result.text += event.results[i][0].transcript;
            result.confidence = event.results[i][0].confidence;
          }
        }
      };

      this.recognition.onend = () => {
        result.duration = (Date.now() - start) / 1000;
        resolve(result);
      };

      audio.onended = () => {
        setTimeout(() => {
          this.recognition.stop();
        }, 1000);
      };

      audio.play().catch(() => resolve(result));
      this.recognition.start();
    });
  }
};

if (typeof window !== 'undefined') {
  window.VerityASR = VerityASR;
}