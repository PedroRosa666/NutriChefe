import { supabase } from '../lib/supabase';

interface UserCredentials {
  fullName: string;
  accountType: 'Nutritionist' | 'Client';
  email: string;
  password: string;
}

export async function registerUser({ fullName, accountType, email, password }: UserCredentials): Promise<void> {
  console.log('registerUser called with:', { fullName, accountType, email });

  // Cria o usuário no Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: fullName,
        accountType,
      }
    }
  });

  if (error) {
    console.error('Error in registerUser:', error.message);
    throw error;
  }

  // Opcional: você pode salvar dados adicionais em uma tabela "users" se quiser
  // if (data.user) {
  //   await supabase.from('users').insert([{
  //     id: data.user.id,
  //     name: fullName,
  //     accountType,
  //     email,
  //   }]);
  // }

  console.log('User registered successfully!');
}

export async function loginUser(email: string, password: string): Promise<void> {
  console.log('loginUser called with:', { email });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Error in loginUser:', error.message);
    throw error;
  }

  console.log('User logged in successfully:', data.user?.id);
}