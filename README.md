# Drug-to-Drug Interaction Checker Web App

This web application allows doctors and healthcare providers to check for potential drug interactions by comparing newly prescribed medicines with a patient's current medications. It utilizes a combination of a local dataset and an API to ensure that drug interactions are efficiently identified.

## Features

* **Drug Interaction Checking**: Automatically checks for drug-to-drug interactions between prescribed and current medications.
* **Patient Management**: Allows healthcare providers to manage a list of patients and their current medications.
* **Database Integration**: The app stores drug interaction data in a PostgreSQL database for faster querying.
* **API Backup**: If an interaction isn't found in the local database, the app queries a backup API (Gemini API) to retrieve the interactions.
* **Interactive UI**: Built with **Next.js**, **TypeScript**, and **Tailwind CSS**, providing a user-friendly interface for healthcare providers.
* **Authentication**: Features session-based authentication for doctors to securely sign up, log in, and access the app.

## Tech Stack

* **Backend**: Django, PostgreSQL
* **Frontend**: Next.js, TypeScript, Tailwind CSS
* **API**: Gemini API (for drug interaction data)
* **Database**: PostgreSQL (for storing drug interactions)

## Installation

### Prerequisites

* Python 3.x
* Node.js 14.x or higher
* PostgreSQL

### Backend Setup (Django)

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/drug-interaction-checker.git
   cd drug-interaction-checker/backend
   ```

2. Install dependencies (make sure to install Django and any other dependencies manually):

   ```bash
   pip install django psycopg2
   ```

3. Set up the PostgreSQL database by creating a new database:

   ```bash
   createdb drug_interaction_db
   ```

4. Run migrations:

   ```bash
   python manage.py migrate
   ```

5. Start the Django development server:

   ```bash
   python manage.py runserver
   ```

### Frontend Setup (Next.js)

1. Navigate to the frontend folder:

   ```bash
   cd ../frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the Next.js development server:

   ```bash
   npm run dev
   ```

### API Integration (Gemini API)

Ensure that you have the necessary credentials for the Gemini API and add them to your environment variables:

```env
GEMINI_API_KEY=your-api-key
```

## Usage

### Authentication

* **Sign Up**: Healthcare providers can sign up to create an account.
* **Log In**: Once registered, healthcare providers can log in to access the app.

### Drug Interaction Checking

1. Add a patient and their current medications to the system.
2. Enter a newly prescribed medication.
3. The system will check for interactions between the new medication and the patient's current medications:

   * If an interaction is found in the local database, it will be returned along with a description.
   * If no interaction is found in the database, the app will query the Gemini API.
   * If no interactions are found, a message stating "No interaction found" will be displayed.
   * If an interaction is found, it will be stored in the local database for future use.

### Logout

Doctors can log out from the application, which will invalidate the session.

## Database Models

* **Patient**: Stores patient information and their current medications.
* **SavedInteraction**: Stores previously checked drug interactions to avoid redundant API calls.
* **DrugInteraction**: Stores drug interaction data fetched from the Gemini API.

## Future Features

* Implement notifications for healthcare providers when new drug interactions are added.
* Add functionality for patients to view their drug interaction history.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Let me know if you'd like to make any further adjustments!
