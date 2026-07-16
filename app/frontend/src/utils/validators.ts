/**
 * GreenGuard — Yup Validation Schemas
 */
import * as Yup from 'yup';

const phoneSchema = Yup.string()
  .matches(/^[0-9+\-\s]{8,15}$/, 'Enter a valid phone number')
  .required('Phone number is required');

export const signInSchema = Yup.object({
  phoneNumber: phoneSchema,
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  agreedToTerms: Yup.boolean()
    .oneOf([true], 'You must agree to the User Agreement and Privacy Policy')
    .required(),
});

export const signUpSchema = Yup.object({
  phoneNumber: phoneSchema,
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm Password is required'),
  displayName: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters')
    .required('Display name is required'),
  agreedToTerms: Yup.boolean()
    .oneOf([true], 'You must agree to the User Agreement and Privacy Policy')
    .required(),
});

export type SignInFormValues = Yup.InferType<typeof signInSchema>;
export type SignUpFormValues = Yup.InferType<typeof signUpSchema>;
