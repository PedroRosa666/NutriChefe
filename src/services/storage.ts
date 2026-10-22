import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image-utils';

export class StorageService {
  private static readonly AVATARS_BUCKET = 'avatars';
  private static readonly RECIPE_IMAGES_BUCKET = 'recipe-images';
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

  static async uploadRecipeImage(userId: string, file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Formato não suportado. Use JPG, PNG ou WebP.');
    }

    // Comprime antes de enviar: a foto do card não precisa de mais que 1200px.
    const blob = await compressImage(file);
    const fileName = `${userId}/${crypto.randomUUID()}.webp`;

    const { error } = await supabase.storage
      .from(this.RECIPE_IMAGES_BUCKET)
      .upload(fileName, blob, {
        cacheControl: '31536000',
        contentType: 'image/webp',
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from(this.RECIPE_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  static getAvatarUrl(userId: string, fileName: string): string {
    const { data } = supabase.storage
      .from(this.AVATARS_BUCKET)
      .getPublicUrl(`${userId}/${fileName}`);

    return data.publicUrl;
  }
}
