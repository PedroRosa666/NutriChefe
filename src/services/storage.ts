import { supabase } from '../lib/supabase';

export class StorageService {
  private static readonly AVATARS_BUCKET = 'avatars';
  private static readonly MAX_FILE_SIZE = 2 * 1024 * 1024;

  static async uploadAvatar(userId: string, file: File): Promise<string> {
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('Imagem muito grande. O tamanho máximo é 2MB.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Formato não suportado. Use JPG, PNG, GIF ou WebP.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(this.AVATARS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(this.AVATARS_BUCKET)
      .getPublicUrl(fileName);

    return `${data.publicUrl}?t=${Date.now()}`;
  }

  static async deleteAvatar(userId: string): Promise<void> {
    const { data: files } = await supabase.storage
      .from(this.AVATARS_BUCKET)
      .list(userId);

    if (files && files.length > 0) {
      const filePaths = files.map((file) => `${userId}/${file.name}`);
      const { error } = await supabase.storage
        .from(this.AVATARS_BUCKET)
        .remove(filePaths);

      if (error) {
        throw error;
      }
    }
  }

  static getAvatarUrl(userId: string, fileName: string): string {
    const { data } = supabase.storage
      .from(this.AVATARS_BUCKET)
      .getPublicUrl(`${userId}/${fileName}`);

    return data.publicUrl;
  }
}
