export type UserType = 'Nutritionist' | 'Client';

interface UserProfile {
  avatar_url?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
  healthGoals?: string[];
  specializations?: string[];
  certifications?: string[];
  experience?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  type: UserType;
  profile?: UserProfile;
}