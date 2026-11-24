import React from 'react';
import { Fragment, useState, useEffect } from 'react';
import {
  Button,
  DBTable,
  LoadingIcon,
  PageContainer,
  PopUp,
  PreviewPdf,
  themeClrs,
  togglePopUp,
} from './Architecture.jsx';
import axios from 'axios';
import { BarLoader } from 'react-spinners';
import { ImCross } from "react-icons/im";

const messages = {
  'invalid' : {
    color: 'red',
    text: 'This file type is invalid.'
  },
  'none' : {
    color: 'blue',
    text: 'Please select a file to upload.'
  },
  'okay' : {
    color: 'green',
    text: 'Okay to upload!'
  },
  'busy' : {
    color: 'green',
    text: 'Uploading... '
  },
};

function Message(data) {
  if (data.type != null) {
    return (
      <Fragment>
        <span className='uploadState' style={{ color: messages[data.type].color, fontWeight: "bold" }} >
          {messages[data.type].text}
        </span>
      </Fragment>
    )
  }

  return null
}

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
                {name: 'Options', cell: (row) => (
                  <Button
                    label={'Modify'}
                  />), ignoreRowClick: true, // each row has onRowClicked={(row,event)=>{...}}
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


function Uploader() {
  const [policyFile, setUploadPolicyFile] = useState(null);
  const [uploadState, setUploadState] = useState('none');
  const [responseInfo, setResponseInfo] = useState({});

  //== File Selection Handling
  const fileChangeHandler = (event) => {
    const selectedFile = event.target.files[0];

    //-- Only accept the file if it is the right file type
    // we must not be currently uploading, the file must not be null, and it must be an embeddable
    if (selectedFile && uploadState !== 'busy' &&
      selectedFile.type == 'application/pdf' ||
      selectedFile.type == 'application/msword' ||
      selectedFile.type == 'text/plain' ||
      selectedFile.type == 'application/rtf' ||
      selectedFile.type == 'text/markdown'
    ) {
      setUploadPolicyFile(selectedFile); // access the first selected file
    } else if (uploadState === 'busy') { // We are currently uploading a file
      console.log('is busy...')
    } else {
      setUploadState('invalid');
      setUploadPolicyFile(null);
    }
  };

  //== When we click the Upload File button
  const submissionHandler = (event) => {
    event.preventDefault(); // disables refresh
    
    if (uploadState !== 'busy' && policyFile != null) {
      console.log('Selected file:', policyFile);
      
      setUploadState('busy');

      const api_url = '/get-policy-path';
      
      //-- Function to fetch the presigned url
      const fetchURL = async () => {
        //== Get path to upload file
        const response = await axios.post(api_url, {
            alias: policyFile.name,
            kind: policyFile.type
        });
        
        const { url, fields } = response.data;
        setResponseInfo({url: url, fields: fields}); // update our response variable
      }
      
      //-- Function to perform the file upload using the presigned url
      
      try {
        fetchURL(); // perform the url fetching
      } catch (error) {
        console.log('Error retrieving url...');
        console.error(error);
      }

    } else if (policyFile == null) { // We have not picked a file
        setUploadState('invalid');
    }
  };
  
  //== File Preview Functions
  const showPreviewFile = () => {
    console.log('showing the file preview...');
    setPrevUrl(URL.createObjectURL(policyFile)); // create a url for previewing the file
    console.log('creating preview url')
    togglePopUp(true); // open the popup for preview
    console.log('showing the popup.');
  }
  
  const removePreview = () => {
    togglePopUp(false);
    prevUrl && URL.revokeObjectURL(prevUrl); // if we have a previous url, then remove it
    setPrevUrl(null); // remove the preview url
  }
  
  //== Policy File Change Management
  useEffect(() => {
    if (policyFile == null) { // when we set this value to null, reset the value of our file object input to zero
      document.getElementById('policyFileUploader').value = null;
    } else {
      console.log('We have an new policy file...');
      setUploadState('okay'); // we are okay to upload
      showPreviewFile(); // when it changes to a new file, show a preview of the file
    }
  }, [policyFile])

  //== Upload State Change Management
  //-- When changes are made to the UploadState
  const [prevUrl, setPrevUrl] = useState(null);
  
  useEffect(() => {
    console.log('upload state changed: ' + uploadState);
    if (uploadState === 'none' && policyFile != null) { // if the new upload state is none, but we still have a policy file selected
      removePreview();
      setUploadPolicyFile(null);
    } else if (uploadState !== 'okay') { // if any changes happen to the file upload state, remove the file pop-up preview.
        removePreview();
    }
  }, [uploadState]);
  
  //== Upload a file using presigned url
  //-- Predefine function
  const performUpload = async () => {
    //== Upload file in path
    const formData = new FormData(); // necessary to upload files
    
    for (const key in responseInfo.fields) {
      formData.append(key, responseInfo.fields[key]);
    }
    
    // Add the content type of this file to the form data
    formData.append('Content-Type',policyFile.type)
    
    formData.append('file', policyFile);
    
    await axios.post(responseInfo.url, formData);
    
    setUploadState('none');
  }
  
  //-- Trigger the uploading whenever the responseInfo is updated
  useEffect(()=> {
    if (policyFile != null && responseInfo != null && Object.keys(responseInfo).length === 2) { // if the policy file exists, the response info var is not null, and we have more than one entry in responseInfo
      try {
        performUpload(); // upload the file...
      } catch (error) {
        console.log('Error uploading file...', error);
      }
    }

  },[responseInfo]);

  return (
    <Fragment>
      <PopUp fill={[
        <p>Previewing file {uploadState === 'okay' && policyFile != null ? policyFile.name : 'none'}.</p>,
        prevUrl ? (<PreviewPdf prevUrl={prevUrl} />) : null,
      ]}
      />
      
      <form onSubmit={submissionHandler}>
        {/*=== DISPLAY THE BAR LOADING IF WE ARE PROCESSING A FILE TO UPLOAD,
          *- otherwise, allow end-user to upload
        */}
        <div className='uploadFile centerChildren'>
          {uploadState !== 'busy' ? (
            <>
              <label htmlFor="policyFileUploader">Attach File</label>
              <input
                type="file"
                id="policyFileUploader"
                onChange={fileChangeHandler}
              />
              <span style={{color: "red", marginRight:10, marginLeft:10}}><ImCross onClick={() => setUploadState('none')} /></span>
            </>
            ) : (<BarLoader
                  height={5}
                    loading
                    width={200}
                    color={themeClrs.icon}
                  />)}

          <p>{policyFile == null ? '...' : policyFile.name}</p>
        </div>
        
        <div className='uploadFileCtrl'>
          <br />
          <Message type={uploadState} />
          <br />
            <span className='centerChildren'>
                <button type='submit'>Upload</button>
            </span>
        </div>
        
      </form>
    </Fragment>
  );
}

function Page() {
  return (
    <Fragment>
        <br/>
        <br/>
        <Uploader />
        <br/>
        <br/>
        <PolicyTable />
    </Fragment>
  );
}

function Policies() {
  return (
    <Fragment>
      <PageContainer
        content={<Page />}
      />
    </Fragment>
  )
}

export default Policies;