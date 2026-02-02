import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../Services/api';

export function ChangePassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- REGEX DE VALIDAÇÃO ---
  // Pelo menos 1 letra, 1 numero, 1 especial, min 8 chars
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
    if (!/[A-Za-z]/.test(pass)) return "A senha deve conter pelo menos uma letra.";
    if (!/\d/.test(pass)) return "A senha deve conter pelo menos um número.";
    if (!/[@$!%*#?&]/.test(pass)) return "A senha deve conter pelo menos um caractere especial (@$!%*#?&).";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 1. Valida Complexidade
    const validationError = validatePassword(newPassword);
    if (validationError) {
        setError(validationError);
        return;
    }

    // 2. Valida Confirmação
    if (newPassword !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
    }

    setLoading(true);
    try {
      await api.post('/users/change-password', { newPassword });
      
      alert("Senha atualizada com sucesso! Acessando o sistema...");
      
      // Atualiza localStorage para liberar o PrivateLayout
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
          const user = JSON.parse(userStr);
          user.mustChangePassword = false; // Importante
          // Garante compatibilidade com maiúsculo/minúsculo
          user.MustChangePassword = false; 
          localStorage.setItem('user_data', JSON.stringify(user));
      }

      // Redireciona
      navigate('/control-tower', { replace: true });

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Erro ao atualizar senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-200">
        
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Crie sua Senha Forte</h2>
          <p className="text-gray-500 mt-2 text-xs leading-relaxed max-w-[280px]">
            Para proteger os dados da DHL, sua senha precisa atender aos requisitos de segurança abaixo.
          </p>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-xs font-bold text-red-600">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}

        {/* Requisitos Visuais */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-[10px] text-gray-500 space-y-1">
            <p className="font-bold uppercase text-gray-400 mb-1">Requisitos:</p>
            <li className={newPassword.length >= 8 ? "text-green-600 font-bold" : ""}>Mínimo 8 caracteres</li>
            <li className={/[A-Za-z]/.test(newPassword) ? "text-green-600 font-bold" : ""}>Pelo menos 1 letra</li>
            <li className={/\d/.test(newPassword) ? "text-green-600 font-bold" : ""}>Pelo menos 1 número</li>
            <li className={/[@$!%*#?&]/.test(newPassword) ? "text-green-600 font-bold" : ""}>Pelo menos 1 especial (@$!%*#?&)</li>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Nova Senha</label>
            <div className="relative group">
                <Lock className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input 
                type="password" 
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-gray-700 bg-white focus:bg-white"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Ex: SenhaForte@123"
                required
                />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Confirmar Senha</label>
            <div className="relative group">
                <CheckCircle2 className={`absolute left-3 top-3.5 transition-colors ${newPassword && confirmPassword && newPassword === confirmPassword ? 'text-green-500' : 'text-gray-400'}`} size={18} />
                <input 
                type="password" 
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 outline-none transition-all font-bold text-gray-700 bg-white ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus:border-red-500 focus:ring-red-50' : 'border-gray-200 focus:border-blue-600 focus:ring-blue-50'}`}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                required
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
          >
            {loading ? 'Validando...' : 'Definir Senha e Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}