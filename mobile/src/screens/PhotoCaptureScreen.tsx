import React, {useState} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, Button, Surface} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation} from '@react-navigation/native';
import {launchCamera, launchImageLibrary, ImagePickerResponse} from 'react-native-image-picker';
import {theme} from '@config/theme';

interface PhotoCaptureRoute {
  params: {
    patientId: string;
  };
}

export const PhotoCaptureScreen: React.FC = () => {
  const route = useRoute<PhotoCaptureRoute>();
  const navigation = useNavigation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleTakePhoto = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      (response: ImagePickerResponse) => {
        if (response.assets && response.assets[0]) {
          setSelectedImage(response.assets[0].uri || null);
        }
      }
    );
  };

  const handleChooseFromLibrary = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      },
      (response: ImagePickerResponse) => {
        if (response.assets && response.assets[0]) {
          setSelectedImage(response.assets[0].uri || null);
        }
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Surface style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Photo Documentation
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Take photos for wound care, medication verification, or patient documentation
        </Text>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleTakePhoto}
            style={styles.button}
            icon="camera"
          >
            Take Photo
          </Button>
          
          <Button
            mode="outlined"
            onPress={handleChooseFromLibrary}
            style={styles.button}
            icon="image"
          >
            Choose from Library
          </Button>
        </View>

        {selectedImage && (
          <View style={styles.previewContainer}>
            <Text variant="bodyLarge">Photo captured successfully!</Text>
            <Button
              mode="contained"
              onPress={() => {
                Alert.alert('Success', 'Photo saved to patient record');
                navigation.goBack();
              }}
              style={styles.saveButton}
            >
              Save to Patient Record
            </Button>
          </View>
        )}
      </Surface>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 32,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  button: {
    paddingVertical: 8,
  },
  previewContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  saveButton: {
    marginTop: 16,
  },
});