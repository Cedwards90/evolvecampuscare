-- Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('student', 'case_manager', 'admin');

-- Create request_status enum type
CREATE TYPE public.request_status AS ENUM ('submitted', 'in_progress', 'escalated', 'resolved', 'cancelled');

-- Create request_priority enum type
CREATE TYPE public.request_priority AS ENUM ('low', 'medium', 'high', 'emergency');

-- Create request_category enum type
CREATE TYPE public.request_category AS ENUM ('academic', 'financial', 'mental_health', 'housing', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    preferred_language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create support_requests table
CREATE TABLE public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    assigned_case_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    category request_category NOT NULL,
    priority request_priority NOT NULL DEFAULT 'medium',
    status request_status NOT NULL DEFAULT 'submitted',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create request_updates table for status history and notes
CREATE TABLE public.request_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    previous_status request_status,
    new_status request_status,
    note TEXT,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    case_manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    meeting_link TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create request_attachments table for document storage references
CREATE TABLE public.request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create offline_drafts table for syncing
CREATE TABLE public.offline_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    draft_data JSONB NOT NULL,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_insights table for storing AI-generated content
CREATE TABLE public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.support_requests(id) ON DELETE CASCADE,
    case_manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL,
    content JSONB NOT NULL,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_requests_updated_at
    BEFORE UPDATE ON public.support_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offline_drafts_updated_at
    BEFORE UPDATE ON public.offline_drafts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY 
        CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'case_manager' THEN 2 
            WHEN 'student' THEN 3 
        END
    LIMIT 1
$$;

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Case managers and admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') OR 
        public.has_role(auth.uid(), 'admin')
    );

-- User roles policies
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Support requests policies
CREATE POLICY "Students can view their own requests"
    ON public.support_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own requests"
    ON public.support_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own pending requests"
    ON public.support_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = student_id AND status = 'submitted');

CREATE POLICY "Case managers can view assigned requests"
    ON public.support_requests FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        (assigned_case_manager_id = auth.uid() OR assigned_case_manager_id IS NULL)
    );

CREATE POLICY "Case managers can update assigned requests"
    ON public.support_requests FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        assigned_case_manager_id = auth.uid()
    );

CREATE POLICY "Admins can view all requests"
    ON public.support_requests FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all requests"
    ON public.support_requests FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Request updates policies
CREATE POLICY "Users can view updates for their requests"
    ON public.request_updates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_requests sr
            WHERE sr.id = request_id AND (
                sr.student_id = auth.uid() OR
                sr.assigned_case_manager_id = auth.uid() OR
                public.has_role(auth.uid(), 'admin')
            )
        ) AND (
            NOT is_internal OR 
            public.has_role(auth.uid(), 'case_manager') OR 
            public.has_role(auth.uid(), 'admin')
        )
    );

CREATE POLICY "Authenticated users can create updates"
    ON public.request_updates FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Appointments policies
CREATE POLICY "Students can view their appointments"
    ON public.appointments FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

CREATE POLICY "Case managers can view their appointments"
    ON public.appointments FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        auth.uid() = case_manager_id
    );

CREATE POLICY "Case managers can create appointments"
    ON public.appointments FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_role(auth.uid(), 'case_manager') AND 
        auth.uid() = case_manager_id
    );

CREATE POLICY "Students can create appointments with assigned case managers"
    ON public.appointments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = student_id AND
        EXISTS (
            SELECT 1 FROM public.support_requests sr
            WHERE sr.student_id = auth.uid() AND sr.assigned_case_manager_id = case_manager_id
        )
    );

CREATE POLICY "Participants can update appointments"
    ON public.appointments FOR UPDATE
    TO authenticated
    USING (auth.uid() = student_id OR auth.uid() = case_manager_id);

CREATE POLICY "Admins can view all appointments"
    ON public.appointments FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Request attachments policies
CREATE POLICY "Users can view attachments for accessible requests"
    ON public.request_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.support_requests sr
            WHERE sr.id = request_id AND (
                sr.student_id = auth.uid() OR
                sr.assigned_case_manager_id = auth.uid() OR
                public.has_role(auth.uid(), 'admin')
            )
        )
    );

CREATE POLICY "Users can upload attachments to their requests"
    ON public.request_attachments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = uploaded_by AND
        EXISTS (
            SELECT 1 FROM public.support_requests sr
            WHERE sr.id = request_id AND sr.student_id = auth.uid()
        )
    );

-- Offline drafts policies
CREATE POLICY "Users can manage their own drafts"
    ON public.offline_drafts FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- AI insights policies
CREATE POLICY "Case managers can view their insights"
    ON public.ai_insights FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        case_manager_id = auth.uid()
    );

CREATE POLICY "Case managers can update their insights"
    ON public.ai_insights FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'case_manager') AND 
        case_manager_id = auth.uid()
    );

CREATE POLICY "Admins can view all insights"
    ON public.ai_insights FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile for new user
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    -- Assign default student role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for request attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'request-attachments',
    'request-attachments',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage policies for request-attachments bucket
CREATE POLICY "Users can upload to their folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'request-attachments' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can view their own files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'request-attachments' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Case managers and admins can view all files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'request-attachments' AND
        (public.has_role(auth.uid(), 'case_manager') OR public.has_role(auth.uid(), 'admin'))
    );

-- Create indexes for better performance
CREATE INDEX idx_support_requests_student_id ON public.support_requests(student_id);
CREATE INDEX idx_support_requests_case_manager_id ON public.support_requests(assigned_case_manager_id);
CREATE INDEX idx_support_requests_status ON public.support_requests(status);
CREATE INDEX idx_support_requests_priority ON public.support_requests(priority);
CREATE INDEX idx_request_updates_request_id ON public.request_updates(request_id);
CREATE INDEX idx_appointments_student_id ON public.appointments(student_id);
CREATE INDEX idx_appointments_case_manager_id ON public.appointments(case_manager_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);