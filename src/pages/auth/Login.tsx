import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña inválida'),
});

const registerSchema = loginSchema.extend({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const onLogin = async (data: LoginData) => {
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate('/dashboard');
  };

  const onRegister = async (data: RegisterData) => {
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.full_name } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-box">
        {/* Logo grande, sin fondo, con sombra y borde blanco */}
        <div className="login-logo-wrapper">
          <img
            src="/images/sonder-logo.png"
            alt="sonder"
            className="login-logo"
          />
        </div>

        <p className="login-subtitle">Todo tu negocio en movimiento</p>

        <div className="login-tabs">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`login-tab ${mode === 'login' ? 'login-tab-active' : ''}`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`login-tab ${mode === 'register' ? 'login-tab-active' : ''}`}
          >
            Registrarse
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="login-form">
            <div className="login-field">
              <label className="login-label">Correo electrónico</label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="correo@empresa.com"
                className="login-input"
              />
              {loginForm.formState.errors.email && (
                <p className="login-field-error">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <div className="login-password-wrapper">
                <input
                  {...loginForm.register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="login-password-toggle"
                >
                  {showPass ? <EyeOff className="login-icon" /> : <Eye className="login-icon" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="login-field-error">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="login-submit">
              {loading && <Loader2 className="login-spinner" />}
              Entrar
            </button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="login-form">
            <div className="login-field">
              <label className="login-label">Nombre completo</label>
              <input
                {...registerForm.register('full_name')}
                placeholder="Juan García"
                className="login-input"
              />
              {registerForm.formState.errors.full_name && (
                <p className="login-field-error">{registerForm.formState.errors.full_name.message}</p>
              )}
            </div>
            <div className="login-field">
              <label className="login-label">Correo electrónico</label>
              <input
                {...registerForm.register('email')}
                type="email"
                placeholder="correo@empresa.com"
                className="login-input"
              />
              {registerForm.formState.errors.email && (
                <p className="login-field-error">{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <div className="login-password-wrapper">
                <input
                  {...registerForm.register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="login-password-toggle"
                >
                  {showPass ? <EyeOff className="login-icon" /> : <Eye className="login-icon" />}
                </button>
              </div>
              {registerForm.formState.errors.password && (
                <p className="login-field-error">{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="login-field">
              <label className="login-label">Confirmar contraseña</label>
              <input
                {...registerForm.register('confirmPassword')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="login-input"
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="login-field-error">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="login-submit">
              {loading && <Loader2 className="login-spinner" />}
              Crear cuenta
            </button>
            <p className="login-info">El primer usuario registrado será administrador</p>
          </form>
        )}
      </div>
    </div>
  );
}