import React from 'react';

// Type definitions for the form mock
interface FormValues {
  [key: string]: any;
}

interface FormErrors {
  [key: string]: string | undefined;
}

interface FormTouched {
  [key: string]: boolean;
}

interface ValidationRules {
  [key: string]: (value: any) => string | undefined;
}

interface UseFormOptions {
  initialValues?: FormValues;
  validate?: ValidationRules;
}

// Mock useForm hook
export const useForm = (options: UseFormOptions = {}) => {
  const [values, setValues] = React.useState<FormValues>(options.initialValues || {});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [touched, setTouched] = React.useState<FormTouched>({});

  const getInputProps = (field: string) => ({
    value: values[field] || '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setValues((prev) => ({ ...prev, [field]: newValue }));
      
      // Clear error when user types
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    onBlur: () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      
      // Run validation if provided
      if (options.validate && options.validate[field]) {
        const error = options.validate[field](values[field]);
        if (error) {
          setErrors((prev) => ({ ...prev, [field]: error }));
        }
      }
    },
    error: touched[field] ? errors[field] : undefined,
  });

  const onSubmit = (handler: (values: FormValues) => void) => {
    return (event?: React.FormEvent) => {
      if (event) {
        event.preventDefault();
      }

      // Run all validations
      if (options.validate) {
        const newErrors: FormErrors = {};
        let hasErrors = false;

        Object.keys(options.validate).forEach((field) => {
          const error = options.validate![field](values[field]);
          if (error) {
            newErrors[field] = error;
            hasErrors = true;
          }
        });

        if (hasErrors) {
          setErrors(newErrors);
          setTouched(
            Object.keys(options.validate).reduce<FormTouched>((acc, field) => {
              acc[field] = true;
              return acc;
            }, {})
          );
          return;
        }
      }

      handler(values);
    };
  };

  const setFieldValue = (field: string, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const setFieldError = (field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const reset = () => {
    setValues(options.initialValues || {});
    setErrors({});
    setTouched({});
  };

  const validate = () => {
    if (!options.validate) return {};

    const newErrors: FormErrors = {};
    Object.keys(options.validate).forEach((field) => {
      const error = options.validate![field](values[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return newErrors;
  };

  return {
    values,
    errors,
    touched,
    getInputProps,
    onSubmit,
    setFieldValue,
    setFieldError,
    reset,
    validate,
    setValues,
    setErrors,
    setTouched,
  };
};