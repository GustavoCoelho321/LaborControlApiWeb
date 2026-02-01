import { api } from './api';

export interface TrainingSample {
    volume: number;
    hour: number;
    approvedHc: number;
    dayIndex: number;
    shiftStart: number;
}

class AIModelService {
    
    // 1. Envia lote de dados para o servidor treinar e salvar
    public async train(processId: number, samples: TrainingSample[]) {
        try {
            // Mapeia garantindo PascalCase (Primeira letra Maiúscula) para o C#
            const payload = {
                ProcessId: processId, // P maiúsculo
                Samples: samples.map(s => ({
                    Volume: s.volume,       // V maiúsculo
                    Hour: s.hour,           // H maiúsculo
                    DayIndex: s.dayIndex,   // D maiúsculo
                    ShiftStart: s.shiftStart, // S maiúsculo
                    ApprovedHc: s.approvedHc  // A maiúsculo
                }))
            };

            console.log(`📡 Enviando Processo ${processId} com ${samples.length} amostras...`, payload);

            const response = await api.post('/aimodel/train', payload);
            console.log(`✅ Resposta do Servidor (${processId}):`, response.data);
            return true;
        } catch (error: any) {
            console.error(`❌ Erro ao treinar processo ${processId}:`, error.response?.data || error.message);
            return false;
        }
    }

    // 2. Pede previsão
    public async predict(processId: number, volume: number, hour: number, dayIndex: number, shiftStart: number): Promise<number | null> {
        try {
            const response = await api.post('/aimodel/predict', {
                ProcessId: processId,
                Volume: volume,
                Hour: hour,
                DayIndex: dayIndex,
                ShiftStart: shiftStart
            });

            const val = response.data.hc;
            return val === -1 ? null : val;
        } catch (error) {
            return null;
        }
    }
}

export const learningService = new AIModelService();