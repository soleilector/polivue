import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  Button,
  DBTable, LinkedButton,
  LoadingIcon,
  PageContainer,
  PopUp,
  PreviewPdf,
  StatusTag,
  themeClrs,
  togglePopUp,
} from './Architecture.jsx';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams } from 'react-router-dom';
import axios from 'axios';

//==== This will test the functionality of the output from Hadi's Claude engine
function TestMarkdown(){
  const { docId } = useParams(); // the name of the document we want to display
  const [ downloadUrl, setDownloadUrl ] = useState(null); // the download url returned by the API request
  const [ downloadState, setDownloadState ] = useState('none'); // 'none', 'busy', 'failed'
  const [ pdfState, setPdfState ] = useState('none'); // 'none', 'busy', 'failed'
  const [ pdfUrl, setPdfUrl ] = useState(null); // the url of the converted pdf, kept so that it can be clicked again
  const [ markdownText, setMarkdownText ] = useState(null); // the contents of a markdown file
  const [ viewUrl, setViewUrl ] = useState(null); // the url used to embed a pdf or text file
  const [ loadState, setLoadState ] = useState('loading'); // 'loading', 'loaded', 'failed', 'unsupported'
  
  //-- The type of file is decided by the end of the file key in the url
  const fileExtension = docId ? docId.split('.').pop().toLowerCase() : '';
  const isMarkdown = fileExtension === 'md';
  const isEmbeddable = fileExtension === 'pdf' || fileExtension === 'txt';
  
  //== Retrieve the document named in the url
  useEffect(() => {
    const loadDocument = async () => {
      if (!isMarkdown && !isEmbeddable) { // we only know how to show markdown, pdf and text files
        setLoadState('unsupported');
        return;
      }
      
      // markdown is read as text, pdf and text files are embedded using a temporary url
      const api_url = isMarkdown ? '/get-markdown' : '/downloadDoc';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort(); // this will cancel the request
      }, 10000);
      
      try {
        const response = await axios.post(api_url, {
          fileName: docId,
          inline: true, // show the file in the page instead of downloading it (only used by /downloadDoc)
        }, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (isMarkdown) {
          setMarkdownText(response.data.content);
        } else {
          setViewUrl(response.data.downloadURL);
        }
        setLoadState('loaded');
      } catch (error) { // Retrieval failed.
        clearTimeout(timeoutId);
        console.log('Could not load ' + docId + ': ' + error.message);
        setLoadState('failed');
      }
    }
    
    // start over each time we are given a different document
    setLoadState('loading');
    setMarkdownText(null);
    setViewUrl(null);
    setDownloadUrl(null); // links from the last document do not belong to this one
    setPdfUrl(null);
    setPdfState('none');
    loadDocument();
  }, [docId]);
  
  //== Let go of the converted pdf when it is replaced or the page is left
  useEffect(() => {
    return () => { if (pdfUrl != null) { URL.revokeObjectURL(pdfUrl); } };
  }, [pdfUrl]);
  
  // Start downloading from a url, or from a file that is held in the browser
  const startFileDownload = (fileUrl, fileName) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
  
  const pdfFileName = docId ? docId.replace(/\.[^.]+$/, '') + '.pdf' : 'document.pdf'; // what the converted file is called
  
  // Converts markdown and text files into a PDF on the server, then downloads the PDF
  const onDownloadPdfClick = async () => {
    if (pdfState === 'busy') { return; } // we are already converting
    
    // We already converted this document during this visit, so download that PDF again instead of converting it again
    if (pdfUrl != null) {
      startFileDownload(pdfUrl, pdfFileName);
      return;
    }
    
    setPdfState('busy');
    
    const api_url = '/convert-to-pdf';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(); // cancels the request
    }, 60000);
    
    try {
      const response = await axios.post(api_url, {
        fileName: docId,
      }, {
        responseType: 'blob', // the pdf comes back as a file
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.data.type !== 'application/pdf') { // we should only ever be given a pdf
        throw new Error('The server did not return a pdf.');
      }
      
      const newPdfUrl = URL.createObjectURL(response.data);
      setPdfUrl(newPdfUrl); // shows the download link, and lets go of any earlier pdf
      startFileDownload(newPdfUrl, pdfFileName);
      
      setPdfState('none');
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Could not convert ' + docId + ' to pdf: ' + error.message);
      setPdfState('failed');
    }
  }
  
  // Downloads the file exactly as it is stored
  const onDownloadClick = async () => {
    if (downloadState === 'busy') { return; } // we are already preparing a download
    
    setDownloadState('busy');
    
    //-- Download the document through a click
    const api_url = '/downloadDoc'; // the api url used to retrieve
    
    // Timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(); // cancels the request
    }, 10000);
    
    try {
      const response = await axios.post(api_url, {
        fileName: docId,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      //-- Retrieve the given file download url, then start the download
      setDownloadUrl(response.data.downloadURL);
      startFileDownload(response.data.downloadURL, docId);
      
      setDownloadState('none');
    } catch (error) {
      clearTimeout(timeoutId);
      console.log('Could not download ' + docId + ': ' + error.message);
      setDownloadState('failed');
    }
  }
  
  return (
    <>
      {/* Floats at the corner of the screen so that it is always available while scrolling */}
      {isMarkdown ? (
        <div className='floatingEdit'>
          <LinkedButton label={'Edit'} link={'/markdown/edit/' + encodeURIComponent(docId)} />
        </div>
      ) : null}
      <Button label={'Download'} onClick={onDownloadClick} /> {isMarkdown || fileExtension === 'txt' ? (<Button label={'Download PDF'} onClick={onDownloadPdfClick} />) : null} {downloadUrl != null ? (<u><a href={downloadUrl}>Download {docId}</a></u>) : null} {pdfUrl != null ? (<u><a href={pdfUrl} download={pdfFileName}>Download {pdfFileName}</a></u>) : null} <br/>
      {/* Lets the user know what is happening with their downloads */}
      {downloadState === 'busy' || pdfState === 'busy' ? (<span className='uploadState' style={{ color: 'green', fontWeight: 'bold' }}>{pdfState === 'busy' ? 'Converting to PDF... ' : 'Preparing download... '}</span>) : null}
      {downloadState === 'failed' ? (<span className='uploadState' style={{ color: 'red', fontWeight: 'bold' }}>Download failed. Please try again.</span>) : null}
      {pdfState === 'failed' ? (<span className='uploadState' style={{ color: 'red', fontWeight: 'bold' }}>PDF conversion failed. Please try again.</span>) : null}
      <br/><br/>
      <div className='docTitleRow'>
        <p>{docId}</p>
        <DocumentStatus docId={docId} />
      </div>
      {loadState === 'loading' ? (<LoadingIcon size={100} />) : null}
      {loadState === 'failed' ? (<p>We could not load this document.</p>) : null}
      {loadState === 'unsupported' ? (<p>Only markdown (.md), pdf, and text (.txt) files can be displayed.</p>) : null}
      
      {/* Markdown is displayed as formatted text */}
      {loadState === 'loaded' && markdownText != null ? (
        <div style={{width:'75%',margin:'auto',padding:'10px',backgroundColor:'white'}}>
          <Markdown remarkPlugins={[remarkGfm]}>{markdownText}</Markdown>
        </div>
      ) : null}
      
      {/* PDF and text files are shown in the same viewer as the Create Policy page */}
      {loadState === 'loaded' && viewUrl != null ? (
        <PreviewPdf prevUrl={viewUrl} fileType={fileExtension === 'txt' ? 'text/plain' : 'application/pdf'} />
      ) : null}
    </>
  );
}

//== The status of a document, with a way to change it
const documentStatuses = ['resolved', 'unresolved', 'remediating'];

function DocumentStatus({ docId }) {
  const [ docStatus, setDocStatus ] = useState(null); // 'resolved', 'unresolved', or 'remediating'
  const [ statusState, setStatusState ] = useState('loading'); // 'loading', 'loaded', 'failed', 'missing'
  const [ isEditing, setIsEditing ] = useState(false);
  const [ chosenStatus, setChosenStatus ] = useState('unresolved'); // the option picked in the drop down list
  const [ saveState, setSaveState ] = useState('none'); // 'none', 'busy', 'failed'
  
  //-- Retrieve the status saved on the document
  useEffect(() => {
    const api_url = '/get-document-status';
    
    const loadStatus = async () => {
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
        
        setDocStatus(response.data.status);
        setStatusState('loaded');
      } catch (error) { // Retrieval failed.
        clearTimeout(timeoutId);
        console.log('Could not load the status of ' + docId + ': ' + error.message);
        setStatusState(error.response?.status === 404 ? 'missing' : 'failed');
      }
    };
    
    setStatusState('loading');
    setIsEditing(false);
    loadStatus();
  }, [docId]);
  
  const onEditStatusClick = () => {
    setChosenStatus(docStatus || 'unresolved');
    setSaveState('none');
    setIsEditing(true);
  }
  
  //-- Save the status picked in the drop down list
  const onSaveStatusClick = async () => {
    if (saveState === 'busy') { return; } // we are already saving
    setSaveState('busy');
    
    const api_url = '/set-document-status';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(); // this will cancel the request
    }, 10000);
    
    try {
      const response = await axios.post(api_url, {
        fileName: docId,
        status: chosenStatus,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      setDocStatus(response.data.status);
      setStatusState('loaded');
      setSaveState('none');
      setIsEditing(false);
    } catch (error) { // Saving failed.
      clearTimeout(timeoutId);
      console.log('Could not save the status of ' + docId + ': ' + error.message);
      setSaveState('failed');
    }
  }
  
  if (statusState === 'loading' || statusState === 'missing') { return null; } // nothing to show for a document that does not exist
  
  return (
    <span className='docStatus'>
      <StatusTag status={statusState === 'loaded' ? docStatus : null} longText={true} />
      {isEditing ? (
        <>
          <select id='docStatusSelect' value={chosenStatus} onChange={(e) => setChosenStatus(e.target.value)}>
            {documentStatuses.map((thisStatus) => (
              <option key={thisStatus} value={thisStatus}>{thisStatus}</option>
            ))}
          </select>
          <Button label={saveState === 'busy' ? 'Saving...' : 'Save'} id='docStatusSave' onClick={onSaveStatusClick} />
          <Button label='Cancel' id='docStatusCancel' onClick={() => { setIsEditing(false); setSaveState('none'); }} />
          {saveState === 'failed' ? (<span className='uploadState' style={{ color: 'red', fontWeight: 'bold' }}>The status could not be saved. Please try again.</span>) : null}
        </>
      ) : (
        statusState === 'loaded' ? (<Button label='Edit Status' id='docStatusEdit' onClick={onEditStatusClick} />) : null
      )}
    </span>
  )
}

function Page(){
  
  const onDownloadClick = () => {
  
  }
  
  return (
    <Fragment>
      <LinkedButton label={'Back'} link={'/markdown/list'} /><br/><br/>
      <p>Edit, download, or view pages and assign statuses here for your documents.</p>
      <br/><br/>
      <hr style={{ color:'black', backgroundColor: 'rgba(19, 59, 74, 0.5)', width: '90%',height: '2px', margin: 'auto',border:'0px' }} />
      <TestMarkdown />
    </Fragment>
  )
}

function MarkdownTest() { // This component dispays the page
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default MarkdownTest;