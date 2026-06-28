/**
 * GreenGuard — Utility: Yup Validation Schemas
 */
import * as Yup from 'yup';

export const signInSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  agreedToTerms: Yup.boolean()
    .oneOf([true], 'You must agree to the User Agreement and Privacy Policy')
    .required(),
});

export const signUpSchema = Yup.object({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm Password is required'),
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .required('Username is required'),
  agreedToTerms: Yup.boolean()
    .oneOf([true], 'You must agree to the User Agreement and Privacy Policy')
    .required(),
});

export type SignInFormValues = Yup.InferType<typeof signInSchema>;
export type SignUpFormValues = Yup.InferType<typeof signUpSchema>;
