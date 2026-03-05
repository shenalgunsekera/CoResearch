import {
  University,
  User,
  Document,
  PendingUser,
  ChatMessage,
} from "@/lib/types";

export const mockUniversities: University[] = [
  { id: "uni-1", name: "University of Oxford", domain: "ox.ac.uk" },
  { id: "uni-2", name: "Stanford University", domain: "stanford.edu" },
  { id: "uni-3", name: "MIT", domain: "mit.edu" },
  { id: "uni-4", name: "Harvard University", domain: "harvard.edu" },
  { id: "uni-5", name: "University of Cambridge", domain: "cam.ac.uk" },
];

export const mockUsers: User[] = [
  {
    id: "user-1",
    email: "admin@oxford.ac.uk",
    name: "Dr. Sarah Williams",
    role: "admin",
    university: mockUniversities[0],
    studentId: "ADM001",
    program: "Administration",
    year: 0,
    interests: [],
    verified: true,
  },
  {
    id: "user-2",
    email: "shenal@oxford.ac.uk",
    name: "Shenal Gunasekera",
    role: "student",
    university: mockUniversities[0],
    studentId: "2525139",
    program: "BSc (Hons) Software Engineering",
    year: 3,
    interests: ["AI", "Machine Learning", "Web Development"],
    verified: true,
  },
  {
    id: "user-3",
    email: "emily.chen@stanford.edu",
    name: "Emily Chen",
    role: "student",
    university: mockUniversities[1],
    studentId: "ST20456",
    program: "Computer Science PhD",
    year: 2,
    interests: ["Natural Language Processing", "Deep Learning"],
    verified: true,
  },
  {
    id: "user-4",
    email: "john.smith@mit.edu",
    name: "John Smith",
    role: "student",
    university: mockUniversities[2],
    studentId: "MIT78901",
    program: "Electrical Engineering",
    year: 4,
    interests: ["Signal Processing", "IoT", "Embedded Systems"],
    verified: true,
  },
];

export const mockDocuments: Document[] = [
  {
    id: "doc-1",
    title: "Machine Learning in Healthcare: A Comprehensive Review",
    content: `# Machine Learning in Healthcare: A Comprehensive Review

## Abstract
This paper provides a comprehensive review of machine learning applications in healthcare, focusing on diagnostic systems, treatment optimization, and patient outcome prediction.

## Introduction
Machine learning has revolutionized healthcare by enabling data-driven decision making...

## Literature Review
Recent studies have shown that ML algorithms can achieve diagnostic accuracy comparable to human experts...

## Methodology
We conducted a systematic review of 150+ papers published between 2020-2025...

## Results
Our findings indicate that deep learning models show particular promise in medical imaging...

## Discussion
While the results are promising, several challenges remain including data privacy, model interpretability...

## Conclusion
Machine learning represents a transformative technology for healthcare...`,
    ownerId: "user-2",
    ownerName: "Shenal Gunasekera",
    collaborators: [
      {
        id: "user-2",
        name: "Shenal Gunasekera",
        email: "shenal@oxford.ac.uk",
        role: "owner",
        joinedAt: "2025-01-15T10:00:00Z",
      },
      {
        id: "user-3",
        name: "Emily Chen",
        email: "emily.chen@stanford.edu",
        role: "editor",
        joinedAt: "2025-01-16T14:30:00Z",
      },
    ],
    versions: [
      {
        id: "v1",
        version: 1,
        content: "Initial draft...",
        author: "Shenal Gunasekera",
        authorId: "user-2",
        timestamp: "2025-01-15T10:00:00Z",
        message: "Initial commit",
        changes: [],
      },
      {
        id: "v2",
        version: 2,
        content: "Added literature review...",
        author: "Emily Chen",
        authorId: "user-3",
        timestamp: "2025-01-20T15:00:00Z",
        message: "Added literature review section",
        changes: [
          {
            type: "addition",
            line: 15,
            content: "## Literature Review section added",
          },
        ],
      },
    ],
    currentVersion: 2,
    field: "Computer Science",
    topic: "Machine Learning",
    stage: "review",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-20T15:00:00Z",
    university: "University of Oxford",
  },
  {
    id: "doc-2",
    title: "Quantum Computing: Theoretical Foundations",
    content: `# Quantum Computing: Theoretical Foundations

## Abstract
An exploration of the theoretical underpinnings of quantum computing...

## Introduction
Quantum computing leverages quantum mechanical phenomena...`,
    ownerId: "user-4",
    ownerName: "John Smith",
    collaborators: [
      {
        id: "user-4",
        name: "John Smith",
        email: "john.smith@mit.edu",
        role: "owner",
        joinedAt: "2025-01-10T09:00:00Z",
      },
    ],
    versions: [
      {
        id: "v1",
        version: 1,
        content: "Initial draft...",
        author: "John Smith",
        authorId: "user-4",
        timestamp: "2025-01-10T09:00:00Z",
        message: "Initial commit",
        changes: [],
      },
    ],
    currentVersion: 1,
    field: "Physics",
    topic: "Quantum Computing",
    stage: "draft",
    createdAt: "2025-01-10T09:00:00Z",
    updatedAt: "2025-01-10T09:00:00Z",
    university: "MIT",
  },
  {
    id: "doc-3",
    title: "Climate Change Impact on Coastal Ecosystems",
    content: `# Climate Change Impact on Coastal Ecosystems

## Abstract
This research examines the effects of climate change on coastal ecosystems...`,
    ownerId: "user-3",
    ownerName: "Emily Chen",
    collaborators: [
      {
        id: "user-3",
        name: "Emily Chen",
        email: "emily.chen@stanford.edu",
        role: "owner",
        joinedAt: "2025-01-12T11:00:00Z",
      },
      {
        id: "user-2",
        name: "Shenal Gunasekera",
        email: "shenal@oxford.ac.uk",
        role: "viewer",
        joinedAt: "2025-01-18T10:00:00Z",
      },
    ],
    versions: [
      {
        id: "v1",
        version: 1,
        content: "Initial draft...",
        author: "Emily Chen",
        authorId: "user-3",
        timestamp: "2025-01-12T11:00:00Z",
        message: "Initial commit",
        changes: [],
      },
    ],
    currentVersion: 1,
    field: "Environmental Science",
    topic: "Climate Change",
    stage: "draft",
    createdAt: "2025-01-12T11:00:00Z",
    updatedAt: "2025-01-12T11:00:00Z",
    university: "Stanford University",
  },
];

export const mockPendingUsers: PendingUser[] = [
  {
    id: "pending-1",
    email: "new.student@oxford.ac.uk",
    name: "Alice Johnson",
    studentId: "OX12345",
    program: "MSc Data Science",
    year: 1,
    interests: ["Data Analytics", "Statistical Learning"],
    university: "University of Oxford",
    submittedAt: "2025-01-25T09:30:00Z",
    status: "pending",
  },
  {
    id: "pending-2",
    email: "bob.wilson@oxford.ac.uk",
    name: "Bob Wilson",
    studentId: "OX67890",
    program: "PhD Computer Science",
    year: 1,
    interests: ["Cybersecurity", "Cryptography"],
    university: "University of Oxford",
    submittedAt: "2025-01-26T14:20:00Z",
    status: "pending",
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: "msg-1",
    senderId: "user-2",
    senderName: "Shenal Gunasekera",
    content: "Has anyone worked with PyTorch for medical imaging?",
    university: "University of Oxford",
    timestamp: "2025-01-27T10:15:00Z",
    channel: "general",
  },
  {
    id: "msg-2",
    senderId: "user-3",
    senderName: "Emily Chen",
    content: "Yes! I used it for my radiology project. Happy to share some resources.",
    university: "Stanford University",
    timestamp: "2025-01-27T10:18:00Z",
    channel: "general",
  },
  {
    id: "msg-3",
    senderId: "user-4",
    senderName: "John Smith",
    content:
      "Check out the fastai library too - it's built on top of PyTorch and great for medical imaging.",
    university: "MIT",
    timestamp: "2025-01-27T10:22:00Z",
    channel: "general",
  },
];

