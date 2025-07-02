import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '@test-utils/test-providers';
import NoteEditor from '../NoteEditor';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('@/services/smarttext.service', () => ({
  getSuggestions: jest.fn().mockResolvedValue([
    { text: 'Patient presents with', confidence: 0.9 },
    { text: 'mild symptoms', confidence: 0.8 },
  ]),
  getAbbreviationExpansion: jest.fn().mockResolvedValue('Chief Complaint'),
}));

jest.mock('@/hooks/useSpellCheck', () => ({
  useSpellCheck: () => ({
    checkSpelling: jest.fn(),
    suggestions: [],
    isChecking: false,
  }),
}));

describe('NoteEditor', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    placeholder: 'Enter your clinical note...',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with basic functionality', () => {
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute('placeholder', 'Enter your clinical note...');
  });

  it('handles text input and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} onChange={onChange} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'Test clinical note content');

    expect(onChange).toHaveBeenCalledWith('Test clinical note content');
  });

  it('displays current value correctly', () => {
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} value="Existing note content" />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    expect(editor).toHaveValue('Existing note content');
  });

  it('supports rich text formatting', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableRichText={true} />
      </TestProviders>
    );

    // Check for formatting toolbar
    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
    
    const boldButton = screen.getByRole('button', { name: /bold/i });
    await user.click(boldButton);
    
    // Check that bold formatting is applied
    expect(boldButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('provides smart text suggestions', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableSmartText={true} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'Pat');

    await waitFor(() => {
      expect(screen.getByText('Patient presents with')).toBeInTheDocument();
    });

    // Click on suggestion
    await user.click(screen.getByText('Patient presents with'));
    
    expect(editor).toHaveValue('Patient presents with');
  });

  it('expands medical abbreviations', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableAbbreviationExpansion={true} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'CC: ');

    await waitFor(() => {
      expect(screen.getByText('Chief Complaint')).toBeInTheDocument();
    });
  });

  it('handles spell check integration', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableSpellCheck={true} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'Pateint has symtoms');

    // Simulate spell check context menu
    fireEvent.contextMenu(editor);
    
    // Mock spell check would show suggestions
    await waitFor(() => {
      expect(screen.getByTestId('spell-check-menu')).toBeInTheDocument();
    });
  });

  it('supports templates and snippets', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableTemplates={true} />
      </TestProviders>
    );

    // Type snippet trigger
    const editor = screen.getByRole('textbox');
    await user.type(editor, '/soap');

    await waitFor(() => {
      expect(screen.getByText('SOAP Note Template')).toBeInTheDocument();
    });

    await user.click(screen.getByText('SOAP Note Template'));
    
    expect(editor).toHaveValue(expect.stringContaining('Subjective:'));
  });

  it('handles voice-to-text functionality', async () => {
    const user = userEvent.setup();
    
    // Mock Speech Recognition API
    const mockSpeechRecognition = {
      start: jest.fn(),
      stop: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    
    (global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
    (global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableVoiceInput={true} />
      </TestProviders>
    );

    const voiceButton = screen.getByRole('button', { name: /voice input/i });
    expect(voiceButton).toBeInTheDocument();
    
    await user.click(voiceButton);
    expect(mockSpeechRecognition.start).toHaveBeenCalled();
  });

  it('supports undo/redo functionality', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    
    // Type some text
    await user.type(editor, 'First line');
    await user.type(editor, '\nSecond line');
    
    // Undo with Ctrl+Z
    await user.keyboard('{Control>}z{/Control}');
    
    expect(editor).toHaveValue('First line');
    
    // Redo with Ctrl+Y
    await user.keyboard('{Control>}y{/Control}');
    
    expect(editor).toHaveValue('First line\nSecond line');
  });

  it('handles autosave with debouncing', async () => {
    const user = userEvent.setup();
    const onAutoSave = jest.fn();
    jest.useFakeTimers();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} onAutoSave={onAutoSave} autoSaveDelay={1000} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'Auto-saved content');
    
    // Fast-forward time to trigger autosave
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onAutoSave).toHaveBeenCalledWith('Auto-saved content');
    
    jest.useRealTimers();
  });

  it('supports collaborative editing indicators', () => {
    const collaborators = [
      { id: '1', name: 'Dr. Smith', cursor: { line: 1, ch: 5 } },
      { id: '2', name: 'Nurse Johnson', cursor: { line: 2, ch: 10 } },
    ];
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} collaborators={collaborators} />
      </TestProviders>
    );

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Nurse Johnson')).toBeInTheDocument();
  });

  it('handles accessibility features', () => {
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    
    expect(editor).toHaveAttribute('aria-label', expect.stringContaining('Clinical note editor'));
    expect(editor).toHaveAttribute('spellcheck', 'true');
  });

  it('supports keyboard shortcuts', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} onSave={onSave} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    editor.focus();
    
    // Save with Ctrl+S
    await user.keyboard('{Control>}s{/Control}');
    
    expect(onSave).toHaveBeenCalled();
  });

  it('handles word count and character limits', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} maxLength={100} showWordCount={true} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, 'This is a test note with multiple words.');
    
    expect(screen.getByText(/word count:/i)).toBeInTheDocument();
    expect(screen.getByText(/characters:/i)).toBeInTheDocument();
  });

  it('supports markdown formatting', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} enableMarkdown={true} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    await user.type(editor, '**Bold text** and *italic text*');
    
    // Check that markdown is rendered in preview
    const previewButton = screen.getByRole('button', { name: /preview/i });
    await user.click(previewButton);
    
    expect(screen.getByText('Bold text')).toHaveStyle('font-weight: bold');
  });

  it('handles focus and blur events', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    
    render(
      <TestProviders>
        <NoteEditor {...defaultProps} onFocus={onFocus} onBlur={onBlur} />
      </TestProviders>
    );

    const editor = screen.getByRole('textbox');
    
    fireEvent.focus(editor);
    expect(onFocus).toHaveBeenCalled();
    
    fireEvent.blur(editor);
    expect(onBlur).toHaveBeenCalled();
  });
});
