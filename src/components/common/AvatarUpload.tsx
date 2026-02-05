import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { StorageService } from '../../services/storage';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { supabase } from '../../lib/supabase';
import { ImageCropModal } from './ImageCropModal';

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        showToast('Arquivo muito grande. O tamanho máximo é 10MB.', 'error');
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

      showToast('Foto de perfil atualizada com sucesso!', 'success');
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

      showToast('Foto de perfil removida com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      showToast(error.message || 'Erro ao remover foto', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = () => {
    if (!user?.fullName) return '?';
    return user.fullName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <>
      <div className="relative inline-block">
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold shadow-lg relative group`}>
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
              {editable && (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              )}
            </>
          ) : (
            <span className={size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : size === 'xl' ? 'text-3xl' : 'text-xl'}>
              {getInitials()}
            </span>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 p-2 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Alterar foto"
            >
              <Upload className="w-4 h-4" />
            </button>

            {previewUrl && (
              <button
                onClick={handleRemoveAvatar}
                disabled={isUploading}
                className="absolute top-0 right-0 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remover foto"
              >
                <X className="w-3 h-3" />
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
