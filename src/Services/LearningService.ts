import * as brain from 'brain.js';
import { api } from './api'; // Certifique-se que o caminho para sua api está correto

interface TrainingSample {
    volume: number;
    hour: number;
    approvedHc: number;
    dayIndex: number;
    shiftStart: number;
}

class AIModelService {
    private nets: Record<number, brain.NeuralNetwork<any, any>> = {};

    constructor() {
        this.loadLocalModels();
        this.syncWithServer(); // Tenta baixar do servidor ao iniciar
    }

    // Carrega do LocalStorage (Backup rápido)
    private loadLocalModels() {
        const saved = localStorage.getItem('ai_brain_models_v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.keys(parsed).forEach(procId => {
                    const net = new brain.NeuralNetwork();
                    net.fromJSON(parsed[procId]);
                    this.nets[Number(procId)] = net;
                });
            } catch (e) {
                console.error("Erro ao carregar modelos locais", e);
            }
        }
    }

    // Baixa inteligência do servidor
    public async syncWithServer() {
        try {
            const response = await api.get('/aimodel');
            if (response.data) {
                response.data.forEach((model: any) => {
                    const net = new brain.NeuralNetwork();
                    const jsonState = JSON.parse(model.modelJson);
                    net.fromJSON(jsonState);
                    this.nets[model.processId] = net;
                });
                console.log("🧠 [IA] Sincronizada com o Servidor!");
            }
        } catch (error) {
            console.warn("⚠️ [IA] Offline ou erro ao sincronizar com servidor (usando local).");
        }
    }

    private saveLocal() {
        const serializable: Record<number, any> = {};
        Object.keys(this.nets).forEach(key => {
            serializable[Number(key)] = this.nets[Number(key)].toJSON();
        });
        localStorage.setItem('ai_brain_models_v2', JSON.stringify(serializable));
    }

    // --- ESTE É O MÉTODO QUE ESTAVA FALTANDO ---
    public getModelJson(processId: number): string | null {
        if (!this.nets[processId]) return null;
        return JSON.stringify(this.nets[processId].toJSON());
    }
    // -------------------------------------------

    public train(processId: number, samples: TrainingSample[]) {
        if (!this.nets[processId]) {
            this.nets[processId] = new brain.NeuralNetwork({ hiddenLayers: [5, 5] });
        }

        const maxVol = Math.max(...samples.map(s => s.volume)) || 1000;
        const maxHc = Math.max(...samples.map(s => s.approvedHc)) || 10;

        // Normalização dos dados (0 a 1)
        const trainingData = samples.map(s => ({
            input: { 
                vol: s.volume / (maxVol * 1.5), 
                hr: s.hour / 24,
                day: s.dayIndex / 6,
                shift: s.shiftStart / 24
            },
            output: { hc: s.approvedHc / (maxHc * 1.5) }
        }));

        this.nets[processId].train(trainingData, {
            iterations: 2000,
            errorThresh: 0.005
        });

        // Salva fatores de normalização para usar no predict
        localStorage.setItem(`norm_factors_v2_${processId}`, JSON.stringify({ maxVol, maxHc }));
        
        this.saveLocal();
    }

    public predict(processId: number, volume: number, hour: number, dayIndex: number, shiftStart: number): number | null {
        if (!this.nets[processId]) return null;

        const factors = JSON.parse(localStorage.getItem(`norm_factors_v2_${processId}`) || '{}');
        if (!factors.maxVol) return null;

        const result = this.nets[processId].run({
            vol: volume / (factors.maxVol * 1.5),
            hr: hour / 24,
            day: dayIndex / 6,
            shift: shiftStart / 24
        });

        const predictedHc = result.hc * (factors.maxHc * 1.5);
        return Math.max(0, predictedHc);
    }
}

export const learningService = new AIModelService();