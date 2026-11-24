import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  Button,
  LinkedButton,
  LoadingIcon,
  PageContainer,
} from './Architecture.jsx';
import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const saveMessages = {
  'busy' : {
    color: 'green',
    text: 'Saving... '
  },
  'saved' : {
    color: 'green',
    text: 'Saved!'
  },
  'failed' : {
    color: 'red',
    text: 'Save failed. Please try again.'
  },
};

//==== Edit a markdown document that is stored in the bucket
function MarkdownEditor() {
  const { docId } = useParams(); // the file key of the document we want to edit
  const [ markdownText, setMarkdownText ] = useState(''); // what is currently in the editor
  const [ savedText, setSavedText ] = useState(''); // what is currently stored in the bucket
  const [ loadState, setLoadState ] = useState('loading'); // 'loading', 'loaded', 'failed', 'unsupported'
  const [ saveState, setSaveState ] = useState('none'); // 'none', 'busy', 'saved', 'failed'
  
  const isMarkdown = docId ? docId.toLowerCase().endsWith('.md') : false; // only markdown files can be edited
  const hasUnsavedChanges = markdownText !== savedText;
  
  //== Retrieve the document named in the url
  useEffect(() => {
    const loadDocument = async () => {
      if (!isMarkdown) { // we only know how to edit markdown
        setLoadState('unsupported');
        return;
      }
      
      const api_url = '/get-markdown';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 10000);
      
      try {
        const response = await axios.post(api_url, {
          fileName: docId,
        }, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        setMarkdownText(response.data.content);
        setSavedText(response.data.content);
        setLoadState('loaded');
      } catch (error) { // Retrieval failed.
        clearTimeout(timeoutId);
        console.log('Could not load ' + docId + ': ' + error.message);
        setLoadState('failed');
      }
    }
    
    // start over each time we are given a different document
    setLoadState('loading');
    setSaveState('none');
    loadDocument();
  }, [docId]);
  
  //== Warn the user before they leave the page with changes that are not saved
  useEffect(() => {
    const warnBeforeLeaving = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ''; // required by some browsers to show the warning
      }
    }
    
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasUnsavedChanges]);
  
  //== Save the editor's contents over the stored document
  const onSaveClick = async () => {
    if (saveState === 'busy') { return; } // we are already saving
    
    setSaveState('busy');
    
    const api_url = '/save-markdown';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(); // this will cancel the request
    }, 20000);
    
    try {
      await axios.post(api_url, {
        fileName: docId,
        content: markdownText,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      setSavedText(markdownText);
      setSaveState('saved');
    } catch (error) { // Save failed.
      clearTimeout(timeoutId);
      console.log('Could not save ' + docId + ': ' + error.message);
      setSaveState('failed');
    }
  }
  
  return (
    <Fragment>
      <LinkedButton label={'Back'} link={'/markdown/list'} /><br/><br/>
      <p>Editing {docId}</p><br/>
      
      {loadState === 'loading' ? (<LoadingIcon size={100} />) : null}
      {loadState === 'failed' ? (<p>We could not load this document.</p>) : null}
      {loadState === 'unsupported' ? (<p>Only markdown (.md) files can be edited.</p>) : null}
      
      {loadState === 'loaded' ? (
        <Fragment>
          <div className='markdownEditor' data-color-mode='light'>
            <MDEditor
              value={markdownText}
              onChange={(newText) => { setMarkdownText(newText || ''); }}
              height={600}
              previewOptions={{
                rehypePlugins: [[rehypeSanitize]], // the preview must not run scripts that are written in a document
              }}
            />
          </div>
          <br/>
          <span className='centerChildren'>
            <Button label={'Save'} id='markdownSave' onClick={onSaveClick} />
            <LinkedButton label={'View'} link={'/markdown/' + encodeURIComponent(docId)} />
          </span>
          <br/>
          {saveState !== 'none' ? (
            <span className='uploadState centerChildren' style={{ color: saveMessages[saveState].color, fontWeight: "bold" }}>
              {saveMessages[saveState].text}
            </span>
          ) : (hasUnsavedChanges ? (
            <span className='uploadState centerChildren'>You have unsaved changes.</span>
          ) : null)}
        </Fragment>
      ) : null}
    </Fragment>
  )
}

function Page() {
  return (
    <Fragment>
      <MarkdownEditor />
    </Fragment>
  )
}

function EditMarkdown() { // This component displays the page
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default EditMarkdown;
