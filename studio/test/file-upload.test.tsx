import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileUpload } from '../src/components/FileUpload';

type EventListener = (event?: {
  lengthComputable?: boolean;
  loaded?: number;
  total?: number;
}) => void;

class MockXMLHttpRequest {
  static lastInstance: MockXMLHttpRequest | null = null;

  public status = 200;
  public responseText = JSON.stringify({
    file_id: 'file-1',
    path: 'pitch-decks/user-1/file.pdf',
    signed_url: 'https://signed.example/file.pdf',
  });
  public method = '';
  public url = '';
  public headers: Record<string, string> = {};
  public upload = {
    addEventListener: (type: string, listener: EventListener) => {
      this.uploadListeners[type] = listener;
    },
  };

  private readonly listeners: Record<string, EventListener> = {};
  private readonly uploadListeners: Record<string, EventListener> = {};

  constructor() {
    MockXMLHttpRequest.lastInstance = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners[type] = listener;
  }

  send(_body: FormData) {
    this.uploadListeners.progress?.({ lengthComputable: true, loaded: 1, total: 1 });
    this.listeners.load?.();
  }
}

describe('FileUpload', () => {
  const originalXmlHttpRequest = global.XMLHttpRequest;

  beforeEach(() => {
    MockXMLHttpRequest.lastInstance = null;
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
  });

  afterAll(() => {
    global.XMLHttpRequest = originalXmlHttpRequest;
  });

  it('sends the auth token as a bearer header to the upload endpoint', async () => {
    const onUploadComplete = jest.fn();

    render(
      <FileUpload
        bucket="pitch-decks"
        authToken="jwt-token"
        onUploadComplete={onUploadComplete}
      />
    );

    fireEvent.change(screen.getByTestId('file-upload-input'), {
      target: {
        files: [new File(['pdf'], 'deck.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled());

    expect(MockXMLHttpRequest.lastInstance?.method).toBe('POST');
    expect(MockXMLHttpRequest.lastInstance?.url).toBe('/api/upload');
    expect(MockXMLHttpRequest.lastInstance?.headers.Authorization).toBe('Bearer jwt-token');
  });
});
