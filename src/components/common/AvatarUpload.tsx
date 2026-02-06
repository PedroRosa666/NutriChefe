import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { StorageService } from '../../services/storage';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { supabase } from '../../lib/supabase';
import { ImageCropModal } from './ImageCropModal';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onAvatarUpdate?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40',
};

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const uploadBtnClasses = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2',
  xl: 'p-2.5',
};

const uploadIconClasses = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
  xl: 'w-4.5 h-4.5',
};

const removeBtnClasses = {
  sm: 'p-0.5',
  md: 'p-1',
  lg: 'p-1.5',
  xl: 'p-1.5',
};

const removeIconClasses = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-3.5 h-3.5',
};

const initialsSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export function AvatarUpload({
  currentAvatarUrl,
  onAvatarUpdate,
  size = 'lg',
  editable = true
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, updateProfile } = useAuthStore();
  const { showToast } = useToastStore();
  const t = useTranslation();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        showToast(t.profile.avatarTooLarge || 'Arquivo muito grande. Max 10MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading file:', error);
      showToast(error.message || 'Erro ao ler arquivo', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    try {
      setIsUploading(true);
      setShowCropModal(false);

      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(croppedFile);

      const avatarUrl = await StorageService.uploadAvatar(user.id, croppedFile);

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (error) throw error;

      await updateProfile({ avatar_url: avatarUrl });

      if (onAvatarUpdate) {
        onAvatarUpdate(avatarUrl);
      }

      showToast(t.profile.avatarUpdated || 'Foto de perfil atualizada!', 'success');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      showToast(error.message || 'Erro ao fazer upload da foto', 'error');
      setPreviewUrl(currentAvatarUrl || null);
    } finally {
      setIsUploading(false);
      setSelectedImage(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setSelectedImage(null);
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    try {
      setIsUploading(true);

      await StorageService.deleteAvatar(user.id);

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

      await updateProfile({ avatar_url: null });
      setPreviewUrl(null);

      if (onAvatarUpdate) {
        onAvatarUpdate('');
      }

      showToast(t.profile.avatarRemoved || 'Foto de perfil removida!', 'success');
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      showToast(error.message || 'Erro ao remover foto', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = () => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <>
      <div className="relative inline-block group">
        <div
          className={cn(
            sizeClasses[size],
            'rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600',
            'flex items-center justify-center text-white font-bold shadow-lg relative',
            'ring-4 ring-white dark:ring-slate-900 transition-shadow duration-200',
            editable && 'cursor-pointer group-hover:shadow-xl'
          )}
          onClick={editable ? () => fileInputRef.current?.click() : undefined}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
              {editable && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <Camera className={cn(iconSizeClasses[size], 'text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300')} />
                </div>
              )}
            </>
          ) : (
            <>
              <span className={initialsSizeClasses[size]}>
                {getInitials()}
              </span>
              {editable && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                  <Camera className={cn(iconSizeClasses[size], 'text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300')} />
                </div>
              )}
            </>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className={cn(iconSizeClasses[size], 'text-white animate-spin')} />
            </div>
          )}
        </div>

        {editable && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className={cn(
                'absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full shadow-lg',
                'hover:bg-emerald-600 hover:scale-110 transition-all duration-200',
                'ring-2 ring-white dark:ring-slate-900',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                uploadBtnClasses[size]
              )}
              title={t.profile.changePhoto || 'Alterar foto'}
            >
              <Upload className={uploadIconClasses[size]} />
            </button>

            {previewUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveAvatar();
                }}
                disabled={isUploading}
                className={cn(
                  'absolute top-0 right-0 bg-red-500 text-white rounded-full shadow-lg',
                  'hover:bg-red-600 hover:scale-110 transition-all duration-200',
                  'ring-2 ring-white dark:ring-slate-900',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                  removeBtnClasses[size]
                )}
                title={t.profile.removePhoto || 'Remover foto'}
              >
                <X className={removeIconClasses[size]} />
              </button>
            )}
          </>
        )}
      </div>

      {showCropModal && selectedImage && (
        <ImageCropModal
          imageSrc={selectedImage}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
