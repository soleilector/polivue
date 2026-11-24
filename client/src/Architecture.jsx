import React, { useEffect } from 'react';
import { Fragment, useState } from 'react';
import { TfiMenu, IoDocumentSharp, HiOutlineDocumentSearch } from "react-icons/tfi";
import { GiParrotHead } from 'react-icons/gi';
import { useLocation } from 'react-router-dom';
import DataTable from "react-data-table-component";
import {ClockLoader} from "react-spinners";
import {FaPlusSquare} from "react-icons/fa";
import {FaCircleXmark} from "react-icons/fa6";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

//== VARIABLES
const COPYRIGHT = '© 2025 Soleil Ector. All rights reserved.';

const pgToLink = {
  'Dashboard' : '/',
  'Create Policy' : '/policy',
  'Connections' : '/connect',
  'Create Connections' : '/create/connect',
  'Query' : '/query',
  'Documents' : '/markdown/list',
}

export const themeClrs = {
    'icon' : '#5cc7d1',
}

//===== FUNCTIONS =====//
const onMainMenuClick = (event) => { // When the main menu button is clicked
  //const clickedId = event.target.id;
  //console.log('Clicked:'+clickedId);
  //console.log(useLocation().pathname);
  const pgmain = document.getElementById('pg-main'); // find the container holding the main page content
  pgmain.classList.toggle('sidebar-open'); // make the class apply to the main container
}

export const togglePopUp = (set) => {
  const popUp = document.getElementById('popup');
  if (popUp) {
    if (set === true) {
      popUp.classList.add('show')
    } else if (set === false) {
      popUp.classList.remove('show')
    } else {
      popUp.classList.toggle('show');
    }
  }
}

export const toggleHadiLongAnswer = (isLong) => {
  const hadiResponseBox = document.getElementById('hadiResponse');
  if (hadiResponseBox) { // if the box exists
    switch (isLong) {
      case true: // // if this is a long answer (255+ characters)
        hadiResponseBox.classList.add('longAnswer');
        break;
      case false: // if this is a short answer (255 characters)
        hadiResponseBox.classList.remove('longAnswer');
        break;
    }
  }
}

//===== COMPONENTS =====//
export function PopUp({ fill }) {
  return (
    <Fragment>
      <div id='popup' className='popup' onClick={togglePopUp}>
        {fill || (<p>Nothing to see here 😖!</p>)}
      </div>
    </Fragment>
  )
}

//== GENERAL ELEMENTS
export function LinkedButton(data) {
  return (
    <Fragment>
      <a href={data.link}>
        <Button
            label={data.label}
            id={data.id}
            className={data.className}
        />
      </a>
    </Fragment>
  )
}

export function Button(data) { // General Button

  return (
    <Fragment>
      <button id={data.id} className={data.className ? data.className : data.id} onClick={data.onClick}>{data.label}</button>
    </Fragment>
  )
}

export function DBTable(data) {
    if (data.columns && data.fill) { // if we have been given both necessary data values.
        return (
            <Fragment>
                <DataTable
                  columns={data.columns}
                  data={data.fill}
                  onRowClicked={data.onRowClicked}
                  highlightOnHover
                />
            </Fragment>
        )
    } else if (data.columns == null) {
        return (<><p>No columns to fill table.</p></>);
    } else { return (<><p>No data to fill table.</p></>); }
}

// Allow pdf's and documents to be embedded and viewed when adding the file
// fileType is optional, and defaults to a pdf (e.g. use 'text/plain' for text files)
export function PreviewPdf(data) {
  if (data.prevUrl == null) {
    return null;
  }
  
  return (
    <Fragment>
      <embed
        src={data.prevUrl}
        type={data.fileType || "application/pdf"}
        className="pdf-preview"
      />
    </Fragment>
  )
}

//== ICONS
export function AppIcon(data) {
  return (
    <Fragment>
      <span className={`app-icon ${data.color}`}><GiParrotHead /></span>
    </Fragment>
  )
}

export function LoadingIcon({ size }) {
    return (
        <span className='centerChildren'>
            <Fragment>
                <ClockLoader size={size || 100} />
            </Fragment>
        </span>
    )
}

export function DocIcon({ size, onClick }) {
  return (
    <>
      <span className='centerChildren docIcon'><FaPlusSquare size={size || 100} onClick={onClick} /></span>
    </>
  )
}

export function CrossOut() { return ( <Fragment><FaCircleXmark/></Fragment>) }

// Enables users to specify a clickable area, upon which the user will copy the text of another specified object
// If copyText is given, that text is copied instead (e.g. the raw markdown of a rendered response)
export function Copyable({ fill, copyId, copyText }) {
  return (
    <>
      <span onClick={async() => {
        const copyTextObj = document.getElementById(copyId);
        if (copyText != null) {
          await navigator.clipboard.writeText(copyText);
        } else if (copyTextObj) {
          await navigator.clipboard.writeText(copyTextObj.innerHTML);
        }
      }}>{fill}</span>
    </>
  )
}

// Displays markdown text from Hadi. Hadi marks line breaks with [BREAK], so turn those back into blank lines
// A colored tag for a document's status: 'resolved', 'unresolved', or 'remediating' (null when it could not be read)
// longText = true shows the sentence used on the view page
export function StatusTag({ status, longText }) {
  const shownStatus = status || 'unknown';
  return (
    <span className={'statusTag status-' + shownStatus}>
      {longText ? (status ? `This document has been marked as ${status}.` : 'We could not read this document\'s status.') : shownStatus}
    </span>
  )
}

export function HadiMarkdown({ fill }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]}>
      {(fill || '').replaceAll('[BREAK]', '\n\n')}
    </Markdown>
  )
}

//== STRUCTURAL
// The sidebar icon
function PageMenu({ items }) { // A menu for displaying the pages
  if (items.length === 0) { // no pages to list
    return null
  } else { // if we have more than one page to list
    return (
      <Fragment>
        <ul className='pg-menu vertical'>
          {
            items.map((pgNm) => (
              <li><a href={pgToLink[pgNm]}>{pgNm}</a></li>
            ))
          }
        </ul>
      </Fragment>
    )
  }
}

export function PageHeading(){ // The heading for a page
  return (
    <Fragment>
      <div className='pg-heading'>
        <div className='pg-nav'>
          <Button
            label={<TfiMenu />}
            id='btn-pg-nav'
            onClick={onMainMenuClick}
          />
          <span className='pg-title'><AppIcon /> Polivue</span>
        </div>
        <div className='search'>
        </div>
      </div>
    </Fragment>
  )
}

export function PageSideBar(){
  return (
    <Fragment>
      <div id='pg-sidebar' className='pg-sidebar'>
        <PageMenu items={[
          'Create Policy',
          'Dashboard',
            'Query',
            'Connections',
            'Documents'
        ]} />
      </div>
    </Fragment>
  )
}

export function PageFooter(){
  return (
    <Fragment>
      <div className='pg-footer'>
        {COPYRIGHT}
      </div>
    </Fragment>
  )
}

export function PageContainer({ content }){
  return (
    <Fragment>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <title>Polivue</title>
      </head>
      <div className="main">
        <PageHeading />

        <div id="pg-main" className="pg-main">
          <PageSideBar />
          <div className="pg-content">{content}</div>
        </div>

        <PageFooter />
      </div>
    </Fragment>
  );
}