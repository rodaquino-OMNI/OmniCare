import React from 'react';

// Mock useForm hook
export const useForm = (options: any = {}) => {
  const [values, setValues] = React.useState(options.initialValues || {});
  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});

  const getInputProps = (field: string) => ({
    value: values[field] || '',
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
      setValues((prev: any) => ({ ...prev, [field]: newValue }));
      
      // Clear error when user types
      if (errors[field]) {
        setErrors((prev: any) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    onBlur: () => {
      setTouched((prev: any) => ({ ...prev, [field]: true }));
      
      // Run validation if provided
      if (options.validate && options.validate[field]) {
        const error = options.validate[field](values[field]);
        if (error) {
          setErrors((prev: any) => ({ ...prev, [field]: error }));
        }
      }
    },
    error: touched[field] ? errors[field] : undefined,
  });

  const onSubmit = (handler: (values: any) => void) => {
    return (event?: React.FormEvent) => {
      if (event) {
        event.preventDefault();
      }

      // Run all validations
      if (options.validate) {
        const newErrors: any = {};
        let hasErrors = false;

        Object.keys(options.validate).forEach((field) => {
          const error = options.validate[field](values[field]);
          if (error) {
            newErrors[field] = error;
            hasErrors = true;
          }
        });

        if (hasErrors) {
          setErrors(newErrors);
          setTouched(
            Object.keys(options.validate).reduce((acc, field) => {
              acc[field] = true;
              return acc;
            }, {} as any)
          );
          return;
        }
      }

      handler(values);
    };
  };

  const setFieldValue = (field: string, value: any) => {
    setValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const setFieldError = (field: string, error: string) => {
    setErrors((prev: any) => ({ ...prev, [field]: error }));
  };

  const reset = () => {
    setValues(options.initialValues || {});
    setErrors({});
    setTouched({});
  };

  const validate = () => {
    if (!options.validate) return {};

    const newErrors: any = {};
    Object.keys(options.validate).forEach((field) => {
      const error = options.validate[field](values[field]);
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