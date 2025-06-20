import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {TextInput, Text, HelperText, Switch, Checkbox} from 'react-native-paper';
import {theme} from '@config/theme';

interface BaseFormFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}

interface TextFormFieldProps extends BaseFormFieldProps {
  type: 'text' | 'email' | 'password' | 'phone' | 'number' | 'multiline';
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  numberOfLines?: number;
  secureTextEntry?: boolean;
}

interface SwitchFormFieldProps extends BaseFormFieldProps {
  type: 'switch';
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface CheckboxFormFieldProps extends BaseFormFieldProps {
  type: 'checkbox';
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface SelectFormFieldProps extends BaseFormFieldProps {
  type: 'select';
  value: string;
  onValueChange: (value: string) => void;
  options: {label: string; value: string}[];
}

type FormFieldProps = 
  | TextFormFieldProps 
  | SwitchFormFieldProps 
  | CheckboxFormFieldProps 
  | SelectFormFieldProps;

export const FormField: React.FC<FormFieldProps> = (props) => {
  const [focused, setFocused] = useState(false);

  const renderLabel = () => {
    if (!props.label) return null;
    
    return (
      <Text style={[
        styles.label,
        props.required && styles.requiredLabel,
        props.error && styles.errorLabel,
        focused && styles.focusedLabel
      ]}>
        {props.label}
        {props.required && ' *'}
      </Text>
    );
  };

  const renderError = () => {
    if (!props.error) return null;
    
    return (
      <HelperText type="error" visible={true}>
        {props.error}
      </HelperText>
    );
  };

  const renderHelperText = () => {
    if (!props.helperText || props.error) return null;
    
    return (
      <HelperText type="info" visible={true}>
        {props.helperText}
      </HelperText>
    );
  };

  if (props.type === 'switch') {
    return (
      <View style={styles.container}>
        <View style={styles.switchContainer}>
          <View style={styles.switchLabelContainer}>
            {renderLabel()}
            {renderHelperText()}
            {renderError()}
          </View>
          <Switch
            value={props.value}
            onValueChange={props.onValueChange}
            disabled={props.disabled}
            style={styles.switch}
          />
        </View>
      </View>
    );
  }

  if (props.type === 'checkbox') {
    return (
      <View style={styles.container}>
        <View style={styles.checkboxContainer}>
          <Checkbox
            status={props.value ? 'checked' : 'unchecked'}
            onPress={() => props.onValueChange(!props.value)}
            disabled={props.disabled}
          />
          <View style={styles.checkboxLabelContainer}>
            {renderLabel()}
            {renderHelperText()}
            {renderError()}
          </View>
        </View>
      </View>
    );
  }

  // Text input types
  const textInputProps = props as TextFormFieldProps;
  
  const getKeyboardType = () => {
    switch (textInputProps.type) {
      case 'email':
        return 'email-address';
      case 'phone':
        return 'phone-pad';
      case 'number':
        return 'numeric';
      default:
        return 'default';
    }
  };

  const getAutoComplete = () => {
    if (textInputProps.autoComplete) return textInputProps.autoComplete;
    
    switch (textInputProps.type) {
      case 'email':
        return 'email';
      case 'password':
        return 'password';
      case 'phone':
        return 'tel';
      default:
        return 'off';
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        label={textInputProps.label + (textInputProps.required ? ' *' : '')}
        value={textInputProps.value}
        onChangeText={textInputProps.onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={textInputProps.placeholder}
        error={!!textInputProps.error}
        disabled={textInputProps.disabled}
        secureTextEntry={textInputProps.secureTextEntry || textInputProps.type === 'password'}
        keyboardType={getKeyboardType()}
        autoComplete={getAutoComplete()}
        maxLength={textInputProps.maxLength}
        multiline={textInputProps.type === 'multiline'}
        numberOfLines={textInputProps.numberOfLines || (textInputProps.type === 'multiline' ? 4 : 1)}
        mode="outlined"
        style={[
          styles.textInput,
          textInputProps.type === 'multiline' && styles.multilineInput
        ]}
        contentStyle={textInputProps.type === 'multiline' ? styles.multilineContent : undefined}
      />
      {renderError()}
      {renderHelperText()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  requiredLabel: {
    // Required indicator handled in text
  },
  errorLabel: {
    color: theme.colors.error,
  },
  focusedLabel: {
    color: theme.colors.primary,
  },
  textInput: {
    backgroundColor: theme.colors.surface,
  },
  multilineInput: {
    minHeight: 100,
  },
  multilineContent: {
    paddingTop: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switch: {
    marginLeft: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  checkboxLabelContainer: {
    flex: 1,
    marginLeft: 8,
  },
});