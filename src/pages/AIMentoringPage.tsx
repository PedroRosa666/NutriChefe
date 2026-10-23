import { useNavigate } from 'react-router-dom';
import { AIMentoringPage as AIMentoringPageComponent } from '../components/ai/AIMentoringPage';

export function AIMentoringPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AIMentoringPageComponent
          // Volta para onde a pessoa estava (ex.: a ficha do paciente); aberta direto, vai para o Início.
          onBack={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/perfil'))}
        />
      </div>
    </div>
  );
}
