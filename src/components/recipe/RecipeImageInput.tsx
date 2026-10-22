import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { StorageService } from '../../services/storage';

interface RecipeImageInputProps {
  value: string;
  onChange: (url: string) => void;
  inputClassName: string;
}

// Campo da foto da receita: aceita um link ou o envio de um arquivo,
// que é comprimido e salvo no Storage do Supabase.
export function RecipeImageInput({ value, onChange, inputClassName }: RecipeImageInputProps) {
  const user = useAuthStore((state) => state.user);
  const t = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await StorageService.uploadRecipeImage(user.id, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.recipe.imageUploadError);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
          placeholder="https://example.com/image.jpg"
          required
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading || !user}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? t.recipe.uploadingImage : t.recipe.uploadImage}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
