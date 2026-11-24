import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

//== Import Pages
import App from './App';
import Policies from './Policies.jsx';
import Dashboard from './Dashboard.jsx'; // create this component
import Connections from './Connections.jsx'; // create this component
import Query from './Query.jsx';
import ManagePolicy from "./ManagePolicy.jsx";
import MarkdownTest from "./MarkdownTest.jsx"; // import pages
import Documents from "./Documents.jsx";
import EditMarkdown from "./EditMarkdown.jsx";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/policy" element={<Policies />} />
        <Route path="/markdown/edit/:docId" element={<EditMarkdown />} />
        <Route path="/markdown/list" element={<Documents />} />
        <Route path="/markdown/:docId" element={<MarkdownTest />} /> {/* This page has the dynamic id element <docId> */}
      <Route path='/manage/policy' element={<ManagePolicy />}/>
        {/*
        <Route path="/create/connect" element={<CreateConnection />} />
        
        <Route path='/manage/connect' element={<ManageConnection />}/>
        <Route path='/manage/report' element={<ManageReport />}/>
        */}
        <Route path="/connect" element={<Connections />} />
        <Route path="/query" element={<Query />} />
        <Route path="/app" element={<App />} />
        {/* Add more routes here */}
    </Routes>
  </BrowserRouter>,
);
