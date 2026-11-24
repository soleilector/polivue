import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  PageContainer,
  AppIcon,
  toggleHadiLongAnswer,
  DocIcon,
  Copyable,
  LoadingIcon,
  themeClrs,
  DBTable,
  Button,
  LinkedButton,
  CrossOut,
  HadiMarkdown,
} from './Architecture.jsx';
import axios from 'axios';
import { ScaleLoader } from 'react-spinners';

//== Display
function PolicyTable(data) {
  const [policyList, updatePolicyList] = useState([]);
  const [thisPolicyPreview, setPreview] = useState(null);
  
  useEffect(()=>{
    const api_url = '/get-policies';
    
    //-- Ask for our list of policies
    const retrievePolicyList = async () => {
      const response = await axios.post(api_url);
      
      console.log(response.data.Contents);
      updatePolicyList(response.data.Contents);
    }
    
    try {
      retrievePolicyList();
    } catch (error) {
      console.log();
    }
  },[]);
  
  return (<Fragment>
    {policyList.length === 0 ? ( // While the policy list loads
      <LoadingIcon data={200} color={themeClrs.icon} />
    ) : (
      <DBTable data={policyList}
               columns={[
                 {name: 'Policy Name', selector: thisPolicy => thisPolicy.Key, sortable: true},
                 {name: 'Size', selector: thisPolicy => thisPolicy.Size, sortable: true},
                 {name: 'Last Modified', selector: thisPolicy => thisPolicy.LastModified, sortable: true},
                 {name: 'Options', cell: (clickedRow) => (
                   <>
                   <Button
                       label={data.selectedDocs !== null && data.selectedDocs.includes(clickedRow.Key) ? ('Selected ✔️') : 'Select'}
                       onClick={e => { // When we select to click this document
                         console.log('Selected '+JSON.stringify(clickedRow.Key));
                         data.onDocSelect(clickedRow.Key);
                       }}
                     />
                   </>
                   ), ignoreRowClick: true, // each row has onRowClicked={(row,event)=>{...}}
                   allowOverflow: true}
               ]}
               fill={policyList}
               onRowClicked={(thisPolicy,event) => {
                 console.log('Row Clicked');
                 setPreview(thisPolicy);
               }} />
    )}
  </Fragment>)
}

const toggleDocList = (set) => {
  const docList = document.getElementById('hadiDocList');
  if (docList) {
    if (set === true) {
      docList.classList.add('show');
    } else if (set === false) {
      docList.classList.remove('show');
    } else {
      docList.classList.toggle('show');
    }
  }
}

function DocList({ onClick, onDocSelect, selectedDocs }) {
  return (
  <Fragment>
    <div id='hadiDocList' className='hadiDocList'>
      <span className='centerChildren' onClick={onClick}><CrossOut /></span>
      <p>List of documents for Hadi</p>
      <PolicyTable
        onDocSelect={onDocSelect}
        selectedDocs={selectedDocs} />
    </div>
  </Fragment>)
}

//== Policy Upload
const MAX_UPLOAD_TRIES = 3; // after this many failed uploads, stop offering a retry

// Shows the upload button, the upload result, or the retry button for saving Hadi's response as a policy
function PolicyUploadStatus({ uploadState, policyName, canUpload, onUploadClick, onRetryClick }) {
  const policyUrl = `${window.location.origin}/markdown/${policyName}`; // where the uploaded policy can be viewed
  
  switch (uploadState) {
    case 'okay': // the upload worked
      return (
        <Fragment>
          <div className='hadiUploadStatus'>
            <p className='uploadSuccess'>Policy upload successful!</p>
            <a href={policyUrl} className='uploadLink'>{policyUrl}</a>
          </div>
        </Fragment>
      )
    case 'failed': // the upload failed, but we still have tries left
      return (
        <Fragment>
          <div className='hadiUploadStatus'>
            <p className='uploadFailed'>Policy upload failed</p>
            <Button
              label='Retry'
              id='hadiUploadRetry'
              onClick={onRetryClick}
            />
          </div>
        </Fragment>
      )
    case 'gaveUp': // out of tries, the text is copied and the page reloads
      return (
        <Fragment>
          <div className='hadiUploadStatus'>
            <p className='uploadFailed fadeIn'>Unsuccessful. We will copy the text to your clipboard and reload the page after 5 seconds.</p>
          </div>
        </Fragment>
      )
    case 'copyFailed': // out of tries, and the browser would not let us copy, so do not reload and lose the text
      return (
        <Fragment>
          <div className='hadiUploadStatus'>
            <p className='uploadFailed fadeIn'>Unsuccessful, and we could not copy the text to your clipboard. Please copy Hadi's response before leaving this page.</p>
          </div>
        </Fragment>
      )
    case 'busy': // the loader is shown in place of the chatbox instead
      return null;
    default: // 'none': offer the upload once Hadi has answered
      return canUpload ? (
        <Fragment>
          <div className='hadiUploadStatus'>
            <Button
              label='Upload Policy?'
              id='hadiUploadPolicy'
              onClick={onUploadClick}
            />
          </div>
        </Fragment>
      ) : null;
  }
}

//== The chat, shown only when Hadi has an Anthropic connection
function Chat({ model }) {

  const [hadiResponse, setHadiResonse] = useState('Caw...'); // For displaying hadi's response
  const [querySubmit, setQuery] = useState('');
  const [docListOpen, setDocListOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [retryTrigger, incrementRetryTrigger] = useState(0); // re-fires the query, even if the query text is the same

  // Hadi could not answer, so offer a retry
  const hadiConfused = hadiResponse === 'Hadi is confused.';

  //== Policy Upload State
  const [hadiAnswered, setHadiAnswered] = useState(false); // true after a successful query
  const [uploadState, setUploadState] = useState('none'); // 'none', 'busy', 'okay', 'failed', 'gaveUp', 'copyFailed'
  const [uploadTries, setUploadTries] = useState(0);
  const [uploadTrigger, incrementUploadTrigger] = useState(0); // fires the upload, also on retries
  const [uploadedPolicyName, setUploadedPolicyName] = useState(null);
  
  const hadiMarkdownText = hadiResponse.replaceAll('[BREAK]','\n\n'); // Hadi's response as plain markdown
  
  // Clear any earlier upload when a new query is sent
  const resetPolicyUpload = () => {
    setHadiAnswered(false);
    setUploadState('none');
    setUploadTries(0);
    setUploadedPolicyName(null);
  }
  
  // Start an upload (or a retry of one)
  const onPolicyUploadClick = () => {
    setUploadState('busy');
    incrementUploadTrigger((oV) => oV + 1);
  }
  
  //-- Upload Hadi's response to the policy bucket as a markdown file
  useEffect(() => {
    if (uploadTrigger === 0) { return; } // nothing to upload when the page first loads
    
    const uploadPolicy = async () => {
      const policyName = `hadi-report-${Date.now()}.md`;
      const policyFile = new File([hadiMarkdownText], policyName, { type: 'text/markdown' });
      
      const api_url = '/get-policy-path'; // same presigned url endpoint the Policies page uses
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 20000);
      
      try {
        //== Get path to upload file
        const response = await axios.post(api_url, {
          alias: policyFile.name,
          kind: policyFile.type
        }, {
          signal: controller.signal,
        });
        
        const { url, fields } = response.data;
        
        //== Upload file in path
        const formData = new FormData(); // necessary to upload files
        for (const key in fields) {
          formData.append(key, fields[key]);
        }
        formData.append('Content-Type', policyFile.type);
        formData.append('file', policyFile);
        
        await axios.post(url, formData, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log('Policy uploaded: ' + policyName);
        setUploadedPolicyName(policyName);
        setUploadState('okay');
      } catch (error) { // Upload failed.
        clearTimeout(timeoutId);
        console.log('Policy upload failed...', error.message);
        
        const tries = uploadTries + 1;
        setUploadTries(tries);
        setUploadState(tries >= MAX_UPLOAD_TRIES ? 'gaveUp' : 'failed'); // stop offering retries after the last try
      }
    }
    
    uploadPolicy();
  }, [uploadTrigger]);
  
  //-- Out of tries: copy the response to the clipboard, then reload the page after 5 seconds
  useEffect(() => {
    if (uploadState !== 'gaveUp') { return; }
    
    const copyAndReload = async () => {
      try {
        await navigator.clipboard.writeText(hadiMarkdownText);
        console.log('Copied Hadi\'s response to the clipboard. Reloading in 5 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } catch (error) { // the browser blocked the copy, so do not reload and lose the text
        console.log('Could not copy to clipboard...', error.message);
        setUploadState('copyFailed');
      }
    }
    
    copyAndReload();
  }, [uploadState]);

  // Only make an API call upon submitting the document
  // DO NOT USE ASYNC FOR USE EFFECT DIRECTLY. REACT CANNOT HANDLE THEM.
  useEffect(() => {

    const fetchData = async () => {
      if (querySubmit != null && querySubmit !== '') {

        const api_url = '/hi-hadi'; // LLM EndPoint
        
        const controller = new AbortController();
        
        const timeoutId = setTimeout(() => {
          controller.abort(); // this will cancel the request
        }, 10000);
        
        try {
          const response = await axios.post(api_url, {
            inquiry: querySubmit,
          }, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const hadiReply = response.data.reply;
          console.log('(Front-end) Hadi says=>' + hadiReply);
          setHadiResonse(hadiReply); // Updates the response variable with API response
          setHadiAnswered(true); // allows the response to be uploaded as a policy
        } catch (error) { // Connection failed.
          console.log('Triggered?');
          setHadiResonse('Hadi is confused.');
          if (axios.isCancel(error)) {
            console.log('Request cancelled or timed out:', error.message);
          } else {
            console.error('(Front-end) Hadi is confused!');
            console.log(error.message);
          }
        }
      }
    };
    
    const fetchAnalysis = async () => {
      if (querySubmit != null && querySubmit !== '') {
        
        const api_url = '/hadi-probe'; // LLM EndPoint
        
        const controller = new AbortController();
        
        const timeoutId = setTimeout(() => {
          controller.abort(); // this will cancel the request
        }, 120000);
        
        try {
          const response = await axios.post(api_url, {
            thisPrompt: querySubmit,
            selectedDocs: JSON.stringify(selectedDocs)
          }, {
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          const hadiReply = response.data.reply;
          console.log('(Front-end) Hadi says=>' + hadiReply);
          setHadiResonse(hadiReply); // Updates the response variable with API response
          setHadiAnswered(true); // allows the response to be uploaded as a policy
        } catch (error) { // Connection failed.
          console.log('Triggered?');
          setHadiResonse('Hadi is confused.');
          if (axios.isCancel(error)) {
            console.log('Request cancelled or timed out:', error.message);
          } else {
            console.error('(Front-end) Hadi is confused!');
            console.log(error.message);
          }
        }
      }
    };
    
    if (selectedDocs.length > 0) {
      fetchAnalysis();
    } else {
      fetchData();
    }
  }, [querySubmit, retryTrigger]); // Triggers API call each time the query is submitted or retried

  // Changes the way the hadi response box displays based on the length of Hadi's response
  useEffect(() => {
    if (hadiResponse) {
      // If we have more than 255 characters, then make the box long. if not, make the box short.
      hadiResponse.length > 255 ? toggleHadiLongAnswer(true) : toggleHadiLongAnswer(false);
    }
  },[hadiResponse]);
  
  // Displays or closes the RAG document selection list based on user input
  useEffect(() => {
    if (docListOpen) {
      toggleDocList(true);
    } else {
      toggleDocList(false);
      console.log(selectedDocs.length)
      if (selectedDocs.length > 0) { // We have selected some documents to attach to our query
        console.log(JSON.stringify(selectedDocs));
      }
    }
  },[docListOpen]);
  
  // Enables users to send queries to Hadi's API
  const onKeyDown = (e) => {
    setDocListOpen(false);
    
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.capsLockKey) { // If we are only pressing the enter key
      if (e.target.value !== null && e.target.value !== '') { // make sure we are not getting a null result
        console.log('You tried to search: '+e.target.value);
        setHadiResonse('loading');
        resetPolicyUpload();
        setQuery(e.target.value); // triggers each time a stored submission is queried
        incrementRetryTrigger((oV) => oV + 1); // so that submitting the same text again still fires
        e.target.value = '';
      }
    }
  }

  return (
    <Fragment>
      <p id='hadiModel' className='hadiModel'>Hadi is using the model <b>{model}</b>. <a href='/connect'>Change the model on the Connections page.</a></p>
      <p>I have queried <AppIcon color='black' /> Hadi for you!</p><br/>
      <br/>
      <div id='hadiSearch' className='hadiSearch'>
        <Copyable fill={
          <div id='hadiResponse' className='hadiResponse'>
            {/* Changes icon based on whether Hadi is responding or static */}
            {hadiResponse === 'loading' ?
              (<span className='hadiLoading'><AppIcon color='black' /></span>)
              : (<AppIcon color='black'/>)}
            
            {hadiResponse === 'loading' ?
              (<span className='hadiResponse loading'><ScaleLoader
                color="#5cc7d1"
                height={15}
                margin={0.5}
                speedMultiplier={2}
                width={4}
              /></span>)
              : (<div id={'hadiResponseCpy'} className='hadiMarkdown'><HadiMarkdown fill={hadiResponse} /></div>)}
          </div>
        } copyId={'hadiResponseCpy'} copyText={hadiMarkdownText} />
        
        {/* The chatbox is hidden while a policy uploads */}
        {uploadState === 'busy' ? (
          <LoadingIcon size={30} />
        ) : (
        <div className='hadiSearchQueryBox'>
          {/* Box to enter query for Hadi */}
          <input id='hadiSearchQuery' type='text' className='hadiSearch query' placeholder={hadiConfused ? 'Just hit return to submit a different query!' : 'Hey Hadi...'}
                 onKeyDown={onKeyDown} />

          {/* Only shown when Hadi could not answer the last query */}
          {hadiConfused ? (
            <Button
              label='Retry?'
              id='hadiRetry'
              onClick={e => {
                setHadiResonse('loading');
                resetPolicyUpload();
                incrementRetryTrigger((oV) => oV + 1); // re-sends the last query
              }}
            />
          ) : null}
          
          {/* A list to open documents to perform RAG queries */}
          <DocIcon size={20} onClick={e => { setDocListOpen(true) }} />
          <p><span className='docCt'>{selectedDocs.length}</span> documents attached...</p>
          <DocList
            onClick={e => { setDocListOpen(false) }}
            onDocSelect={rowKey => {
              // If we trigger this function, and are given the name of the document that we want to select...
              if (selectedDocs.includes(rowKey)) { // if we have selected this document before, remove it...
                setSelectedDocs((oldValue) => {
                  return oldValue.filter((doc) => doc !== rowKey); // allot all documents except one to remove...
                });
              } else { // if we have not selected this document before, add it...
                setSelectedDocs((oldValue) => {
                  oldValue.push(rowKey);
                  return oldValue.filter(doc => doc === doc); // same as return oldValue, but forces the docs list to update selected status with proper sync
                });
              }
              console.log('Selected doc list updated: ' + JSON.stringify(selectedDocs, null, 2));
            }}
            
            selectedDocs={selectedDocs}
            
          />
        </div>
        )}
        
        <PolicyUploadStatus
          uploadState={uploadState}
          policyName={uploadedPolicyName}
          canUpload={hadiAnswered && hadiResponse !== 'loading'}
          onUploadClick={onPolicyUploadClick}
          onRetryClick={onPolicyUploadClick}
        />
      </div>
    </Fragment>
  )
}

function Page() {
  const [anthropicState, setAnthropicState] = useState('checking'); // 'checking', 'connected', 'missing', 'awsMissing', 'failed'
  const [anthropicModel, setAnthropicModel] = useState('');
  
  //-- Check that Hadi has an Anthropic connection before showing the chat
  useEffect(() => {
    const checkAnthropicConnection = async () => {
      const api_url = '/get-anthropic-connection';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 10000);
      
      try {
        const response = await axios.post(api_url, {}, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.data.exists) {
          setAnthropicModel(response.data.model);
          // an 'AWS-' Anthropic key is retrieved through AWS Secrets Manager, so that needs a connection too
          setAnthropicState(response.data.awsMissing ? 'awsMissing' : 'connected');
        } else {
          setAnthropicState('missing');
        }
      } catch (error) { // Connection failed.
        clearTimeout(timeoutId);
        console.log('Could not check for an Anthropic connection: ' + error.message);
        setAnthropicState('failed');
      }
    };
    
    checkAnthropicConnection();
  }, []);
  
  if (anthropicState === 'checking') {
    return (<div className='anthropicNotice'><LoadingIcon size={30} /></div>);
  }
  if (anthropicState === 'failed') {
    return (<div className='anthropicNotice'><p>We could not check for an Anthropic connection. Please reload the page.</p></div>);
  }
  if (anthropicState === 'awsMissing') {
    return (
      <div id='awsNotice' className='anthropicNotice'>
        <p>Please connect to AWS Secrets Manager to proceed.</p>
        <p>The AWS connector is used to grab secrets specified with 'AWS-' prefix in your connector's 'authToken' field.</p>
        <LinkedButton label='Go to Connections' id='awsConnect' link='/connect' />
      </div>
    );
  }
  if (anthropicState === 'missing') {
    return (
      <div id='anthropicNotice' className='anthropicNotice'>
        <p>Please connect to Anthropic API to proceed.</p>
        <LinkedButton label='Go to Connections' id='anthropicConnect' link='/connect' />
      </div>
    );
  }
  
  return (<Chat model={anthropicModel} />);
}

function Query(){
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )

}

export default Query;